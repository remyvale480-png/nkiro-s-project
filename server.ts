import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  buildPikoSystemInstruction,
  RECOGNIZE_RESPONSE_SCHEMA,
  SOLVE_RESPONSE_SCHEMA,
} from "./src/server/pikoPrompt.ts";
import {
  buildCacheKey,
  normalizeMathExpression,
  verifyMathSolution,
} from "./src/server/mathVerifier.ts";
import type {
  CurriculumId,
  NotationStyle,
  RecognizeResult,
  SolveResult,
} from "./src/shared/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DAILY_FREE_QUOTA = 15; // Generous demo daily limit per browser client

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function selectSolveModel(problem: string): {
  model: string;
  thinkingLevel: ThinkingLevel;
} {
  const normalized = normalizeMathExpression(problem);
  const isComplex =
    normalized.length > 42 ||
    /\\int|\\sum|\\lim|sin|cos|tan|log|sqrt|\^2|\^3|derivative|integral|word|find|prove/i.test(
      problem
    );

  if (isComplex) {
    return {
      model: "gemini-4-hydrogen",
      thinkingLevel: ThinkingLevel.HIGH,
    };
  }
  return {
    model: "gemini-3.1-flash-lite",
    thinkingLevel: ThinkingLevel.MINIMAL,
  };
}

// In-memory normalized cache, share store, & per-client daily quota store
const solutionCache = new Map<string, SolveResult>();
const sharedSolutions = new Map<
  string,
  { solution: SolveResult; curriculum: CurriculumId; gradeLevel: string; notation: NotationStyle }
>();
const dailyQuotaMap = new Map<string, { date: string; used: number }>();
const rateWindowMap = new Map<string, { windowStart: number; count: number }>();

function getClientKey(req: express.Request): string {
  const headerId = req.headers["x-piko-client-id"];
  if (typeof headerId === "string" && headerId.trim().length > 0) {
    return headerId.trim().slice(0, 64);
  }
  return req.ip || "anonymous";
}

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const entry = rateWindowMap.get(clientKey);
  if (!entry || now - entry.windowStart > 60_000) {
    rateWindowMap.set(clientKey, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count += 1;
  return true;
}

function getQuotaState(clientKey: string): { date: string; used: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const existing = dailyQuotaMap.get(clientKey);
  if (!existing || existing.date !== today) {
    const fresh = { date: today, used: 0 };
    dailyQuotaMap.set(clientKey, fresh);
    return { ...fresh, remaining: DAILY_FREE_QUOTA };
  }
  return {
    ...existing,
    remaining: Math.max(0, DAILY_FREE_QUOTA - existing.used),
  };
}

function consumeQuota(clientKey: string): number {
  const state = getQuotaState(clientKey);
  const nextUsed = state.used + 1;
  dailyQuotaMap.set(clientKey, { date: state.date, used: nextUsed });
  return Math.max(0, DAILY_FREE_QUOTA - nextUsed);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "6mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Piko Math" });
  });

  app.get("/api/quota", (req, res) => {
    const clientKey = getClientKey(req);
    const q = getQuotaState(clientKey);
    res.json({ dailyLimit: DAILY_FREE_QUOTA, used: q.used, remaining: q.remaining });
  });

  app.get("/api/solutions/:id", (req, res) => {
    const entry = sharedSolutions.get(req.params.id);
    if (!entry) {
      res.status(404).json({ error: "Shared solution not found." });
      return;
    }
    res.json(entry);
  });

  // OCR / Handwriting Recognition endpoint (imageDataUrl -> editable LaTeX + plain math)
  app.post("/api/recognize", async (req, res) => {
    const clientKey = getClientKey(req);
    if (!checkRateLimit(clientKey)) {
      res.status(429).json({ error: "Too many requests. Please pause a moment and try again." });
      return;
    }

    const { imageBase64, mimeType, source } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      source?: "camera" | "handwriting";
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "Missing image data to recognize." });
      return;
    }

    try {
      const ai = getAiClient();
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const promptText =
        source === "handwriting"
          ? "Transcribe the handwritten math expression in this sketch accurately. Return plain ASCII math and clean KaTeX LaTeX. Do not solve it yet."
          : "Transcribe the math problem shown in this student photo accurately. Focus on the main problem expression or equation. Do not solve it yet.";

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: RECOGNIZE_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText) as RecognizeResult;
      res.json(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to read math from image.";
      res.status(502).json({ error: message });
    }
  });

  // Core Solve endpoint: Normalize -> Cache -> Model Route -> Gemini JSON -> Math Verification
  app.post("/api/solve", async (req, res) => {
    const clientKey = getClientKey(req);
    if (!checkRateLimit(clientKey)) {
      res.status(429).json({ error: "Slow down a bit—Piko needs a quick breather!" });
      return;
    }

    const {
      problem,
      curriculum = "US_COMMON_CORE",
      gradeLevel = "Grade 8",
      notation = "point_obelus",
      language = "en",
    } = req.body as {
      problem?: string;
      curriculum?: CurriculumId;
      gradeLevel?: string;
      notation?: NotationStyle;
      language?: string;
    };

    if (!problem || typeof problem !== "string" || problem.trim().length === 0) {
      res.status(400).json({ error: "Please enter or snap a math problem first." });
      return;
    }

    const cacheKey = buildCacheKey(problem, curriculum, notation);
    const cached = solutionCache.get(cacheKey);
    if (cached && cached.verificationStatus === "verified") {
      const q = getQuotaState(clientKey);
      sharedSolutions.set(cached.id, {
        solution: cached,
        curriculum,
        gradeLevel,
        notation,
      });
      res.json({
        ...cached,
        cached: true,
        remainingQuota: q.remaining,
      });
      return;
    }

    const quota = getQuotaState(clientKey);
    if (quota.remaining <= 0) {
      res.status(429).json({
        error: "You have used all daily free solves. Upgrade to Piko Plus or come back tomorrow!",
        remainingQuota: 0,
      });
      return;
    }

    try {
      const ai = getAiClient();
      const { model, thinkingLevel } = selectSolveModel(problem);
      const systemInstruction = buildPikoSystemInstruction(
        curriculum,
        gradeLevel,
        notation,
        language
      );

      const response = await ai.models.generateContent({
        model,
        contents: `Solve this math problem step by step for the student:\n${problem.trim()}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: SOLVE_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel },
        },
      });

      const rawJson = (response.text ?? "{}").trim();
      const generated = JSON.parse(rawJson) as Omit<
        SolveResult,
        "id" | "verificationStatus" | "verificationMessage" | "modelUsed" | "cached" | "remainingQuota"
      >;

      const verification = verifyMathSolution(
        generated.normalizedProblem || problem,
        generated.finalAnswerPlain,
        generated.confidence ?? 0.8
      );

      const remainingQuota = consumeQuota(clientKey);
      const result: SolveResult = {
        ...generated,
        id: `sol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationStatus: verification.status,
        verificationMessage: verification.message,
        modelUsed: model,
        cached: false,
        remainingQuota,
      };

      if (verification.status === "verified") {
        solutionCache.set(cacheKey, result);
      }
      sharedSolutions.set(result.id, {
        solution: result,
        curriculum,
        gradeLevel,
        notation,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Piko hit a snag while solving that problem.";
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Piko Math server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
