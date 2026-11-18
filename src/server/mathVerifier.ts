import { create, all } from "mathjs";
import type { VerificationStatus } from "../shared/types.ts";

const math = create(all, {});

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
}

/**
 * Normalizes human/LaTeX math input into canonical mathjs-friendly ASCII syntax.
 */
export function normalizeMathExpression(raw: string): string {
  let s = raw.trim();
  // Replace regional/unicode math symbols
  s = s
    .replace(/×/g, "*")
    .replace(/·/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, "pi")
    .replace(/√\(([^)]+)\)/g, "sqrt($1)")
    .replace(/√([0-9a-zA-Z]+)/g, "sqrt($1)");

  // Convert common LaTeX constructs
  s = s
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\ln/g, "log")
    .replace(/\\log/g, "log10");

  // Handle decimal commas (e.g. 3,5 -> 3.5) when not separating list items
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  return s.replace(/\s+/g, " ").trim();
}

export function buildCacheKey(problem: string, curriculum: string, notation: string): string {
  return `${curriculum}::${notation}::${normalizeMathExpression(problem).toLowerCase()}`;
}

function approxEqual(a: unknown, b: unknown, eps = 1e-5): boolean {
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= eps * Math.max(1, Math.abs(na), Math.abs(nb));
}

function parseCandidateValues(answerStr: string): Array<{ variable: string | null; valueExpr: string }> {
  const cleaned = normalizeMathExpression(answerStr);
  // Split multiple roots like "x = 2, x = 3" or "x = 2, 3" or "x = 2 or x = 3"
  const parts = cleaned
    .replace(/\band\b|\bor\b|;/gi, ",")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const results: Array<{ variable: string | null; valueExpr: string }> = [];
  let lastVar: string | null = null;

  for (const part of parts) {
    if (part.includes("=")) {
      const [lhs, rhs] = part.split("=").map((x) => x.trim());
      if (/^[a-zA-Z]$/.test(lhs) && rhs) {
        lastVar = lhs;
        results.push({ variable: lhs, valueExpr: rhs });
      } else if (/^[a-zA-Z]$/.test(rhs) && lhs) {
        lastVar = rhs;
        results.push({ variable: rhs, valueExpr: lhs });
      } else {
        results.push({ variable: lastVar, valueExpr: rhs || part });
      }
    } else {
      results.push({ variable: lastVar, valueExpr: part });
    }
  }
  return results;
}

/**
 * Verifies the LLM's final answer against the original problem using mathjs symbolic & numeric checks.
 */
export function verifyMathSolution(
  normalizedProblem: string,
  finalAnswerPlain: string,
  confidence: number
): VerificationResult {
  if (confidence < 0.75) {
    return {
      status: "unverified",
      message: "Piko has lower confidence on this reading. Please verify each step carefully.",
    };
  }

  const prob = normalizeMathExpression(normalizedProblem);
  const ans = normalizeMathExpression(finalAnswerPlain);

  if (!prob || !ans) {
    return {
      status: "unverified",
      message: "Could not parse expression for automatic symbolic verification.",
    };
  }

  try {
    // Case 1: Derivative command, e.g. "d/dx (3x^2 + 4x)" or "derivative of 3x^2 + 4x"
    const derivMatch = prob.match(/^(?:d\/d([a-zA-Z])\s*|derivative\s+of\s+)(.+)$/i);
    if (derivMatch) {
      const variable = derivMatch[1] || "x";
      const targetExpr = derivMatch[2].replace(/^\((.*)\)$/, "$1");
      const derivNode = math.derivative(targetExpr, variable);
      const ansExpr = ans.includes("=") ? ans.split("=").pop()!.trim() : ans;
      const testPoints = [-2.1, -0.7, 0.8, 1.9, 3.3];
      let matched = true;
      for (const xVal of testPoints) {
        const expected = derivNode.evaluate({ [variable]: xVal });
        const actual = math.evaluate(ansExpr, { [variable]: xVal });
        if (!approxEqual(expected, actual)) {
          matched = false;
          break;
        }
      }
      return matched
        ? { status: "verified", message: "Verified symbolically via derivative check." }
        : { status: "mismatch", message: "Symbolic derivative check disagreed with the proposed answer." };
    }

    // Case 2: Equation with "=" (single-variable or multi-variable substitution)
    if (prob.includes("=") && !prob.includes("==") && !prob.includes(";") && !prob.includes(",")) {
      const sides = prob.split("=");
      if (sides.length === 2) {
        const [lhs, rhs] = sides.map((s) => s.trim());
        const candidates = parseCandidateValues(ans);
        if (candidates.length > 0) {
          // Determine variable in equation
          const varsInEq = Array.from(new Set((prob.match(/\b[a-zA-Z]\b/g) || []).filter((v) => v !== "e" && v !== "i")));
          const targetVar = candidates[0].variable || (varsInEq.length === 1 ? varsInEq[0] : null);

          if (targetVar && varsInEq.length <= 1) {
            let allRootsHold = true;
            let checkedAny = false;
            for (const cand of candidates) {
              if (cand.valueExpr.toLowerCase().includes("no solution") || cand.valueExpr.toLowerCase().includes("all real")) {
                return { status: "unverified", message: "Special solution set; verify reasoning steps manually." };
              }
              const val = math.evaluate(cand.valueExpr);
              if (typeof val === "number" && Number.isFinite(val)) {
                checkedAny = true;
                const lVal = math.evaluate(lhs, { [targetVar]: val });
                const rVal = math.evaluate(rhs, { [targetVar]: val });
                if (!approxEqual(lVal, rVal)) {
                  allRootsHold = false;
                  break;
                }
              }
            }
            if (checkedAny) {
              return allRootsHold
                ? { status: "verified", message: "Verified by substituting solution back into the equation." }
                : { status: "mismatch", message: "Substitution check failed — please review the steps carefully." };
            }
          }
        }
      }
    }

    // Case 3: Pure numeric arithmetic expression (no free variables)
    const varsInProb = Array.from(new Set((prob.match(/\b[a-zA-Z]+\b/g) || []).filter(
      (w) => !["sin", "cos", "tan", "sqrt", "log", "log10", "pi", "e", "abs"].includes(w.toLowerCase())
    )));

    if (varsInProb.length === 0 && !prob.includes("=")) {
      const cleanAns = ans.includes("=") ? ans.split("=").pop()!.trim() : ans;
      const expected = math.evaluate(prob);
      const actual = math.evaluate(cleanAns);
      if (approxEqual(expected, actual)) {
        return { status: "verified", message: "Verified numerically against exact expression." };
      }
      return { status: "mismatch", message: "Numeric check disagreed with the proposed answer." };
    }

    // Case 4: Algebraic simplification / expansion with single variable (e.g. (x+2)^2 -> x^2+4x+4)
    if (varsInProb.length === 1 && !prob.includes("=")) {
      const v = varsInProb[0];
      const cleanAns = ans.includes("=") ? ans.split("=").pop()!.trim() : ans;
      const testPoints = [-2.4, -0.6, 0.9, 2.3, 4.1];
      let matched = true;
      for (const t of testPoints) {
        const expected = math.evaluate(prob, { [v]: t });
        const actual = math.evaluate(cleanAns, { [v]: t });
        if (!approxEqual(expected, actual)) {
          matched = false;
          break;
        }
      }
      return matched
        ? { status: "verified", message: "Verified algebraically across symbolic test points." }
        : { status: "mismatch", message: "Algebraic equivalence check failed — review the steps." };
    }

    return {
      status: "unverified",
      message: "Word problem or multi-step form not auto-checked symbolically; review steps below.",
    };
  } catch {
    return {
      status: "unverified",
      message: "Symbolic parser could not verify this format automatically; inspect steps carefully.",
    };
  }
}
