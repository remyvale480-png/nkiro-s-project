import { Type } from "@google/genai";
import type { CurriculumId, NotationStyle } from "../shared/types.ts";

export const CURRICULUM_LABELS: Record<CurriculumId, string> = {
  US_COMMON_CORE: "US Common Core",
  UK_GCSE_ALEVEL: "UK GCSE / A-Level",
  IB: "International Baccalaureate (IB)",
  INDIA_CBSE: "India CBSE / NCERT",
  KENYA_KCSE: "Kenya KCSE / CBC",
  NIGERIA_WAEC: "Nigeria WAEC",
};

export function buildPikoSystemInstruction(
  curriculum: CurriculumId,
  gradeLevel: string,
  notation: NotationStyle,
  languageCode: string = "en"
): string {
  const curriculumName = CURRICULUM_LABELS[curriculum] || "General Mathematics";
  const decimalNote =
    notation === "comma_slash"
      ? "Use decimal commas (e.g. 3,5) in prose if writing decimals, and / for division."
      : "Use decimal points (e.g. 3.5) and standard ÷ or fraction notation.";

  return [
    "You are Piko, a friendly, encouraging AI math tutor shaped like the pi symbol (π).",
    "Voice rules:",
    "- Speak directly to a student aged 11-18 in short, simple sentences that translate cleanly.",
    "- Be warm, clear, and encouraging—never childish, robotic, or condescending.",
    "- Focus on teaching WHY each step works, not just dumping algebra.",
    `Curriculum context: ${curriculumName}, Grade/Level: ${gradeLevel}.`,
    `Language: ${languageCode}. ${decimalNote}`,
    "Accuracy rules:",
    "- Show every logical step clearly in numbered order.",
    "- Put clean KaTeX-compatible LaTeX in expressionLatex and finalAnswerLatex.",
    "- Put simple ASCII math in finalAnswerPlain (e.g. 'x = 6' or '12.5' or '2x + 3') so our symbolic verifier can check it.",
    "- Set confidence between 0.0 and 1.0 honestly; lower it below 0.75 if the problem is ambiguous or incomplete.",
    "- Keep each 'why' explanation to 1-2 short sentences.",
  ].join("\n");
}

export const SOLVE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    normalizedProblem: {
      type: Type.STRING,
      description: "Clean plain-text mathematical statement of the problem.",
    },
    problemLatex: {
      type: Type.STRING,
      description: "KaTeX-ready LaTeX of the problem statement.",
    },
    topic: {
      type: Type.STRING,
      description: "Primary math topic such as Linear Equations, Quadratics, Fractions, Calculus, or Trigonometry.",
    },
    difficulty: {
      type: Type.STRING,
      description: "One of: easy, medium, hard.",
    },
    curriculumTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1 to 3 short curriculum or skill tags.",
    },
    pikoGreeting: {
      type: Type.STRING,
      description: "One short friendly sentence from Piko introducing the approach.",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          expressionLatex: { type: Type.STRING },
          expressionPlain: { type: Type.STRING },
          why: {
            type: Type.STRING,
            description: "1-2 short, clear sentences explaining why this step happens in Piko's voice.",
          },
        },
        required: ["stepNumber", "expressionLatex", "expressionPlain", "why"],
      },
    },
    finalAnswerLatex: {
      type: Type.STRING,
      description: "Final answer formatted in clean LaTeX.",
    },
    finalAnswerPlain: {
      type: Type.STRING,
      description: "Final answer in plain ASCII math (e.g. 'x = 6', 'x = 2, 3', or '19/12').",
    },
    hints: {
      type: Type.OBJECT,
      properties: {
        nudge: { type: Type.STRING, description: "Gentle first nudge without giving away numbers." },
        biggerHint: { type: Type.STRING, description: "Clearer method hint naming the operation or rule." },
        nextStep: { type: Type.STRING, description: "The first concrete algebraic step to get started." },
      },
      required: ["nudge", "biggerHint", "nextStep"],
    },
    confidence: {
      type: Type.NUMBER,
      description: "Model confidence from 0.0 to 1.0.",
    },
  },
  required: [
    "normalizedProblem",
    "problemLatex",
    "topic",
    "difficulty",
    "curriculumTags",
    "pikoGreeting",
    "steps",
    "finalAnswerLatex",
    "finalAnswerPlain",
    "hints",
    "confidence",
  ],
};

export const RECOGNIZE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recognizedPlain: {
      type: Type.STRING,
      description: "Plain math expression transcribed from the image or sketch (e.g. '2x + 5 = 17').",
    },
    recognizedLatex: {
      type: Type.STRING,
      description: "KaTeX-compatible LaTeX version of the transcribed math.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "OCR confidence between 0.0 and 1.0.",
    },
    notes: {
      type: Type.STRING,
      description: "Optional brief note if handwriting or image crop was unclear.",
    },
  },
  required: ["recognizedPlain", "recognizedLatex", "confidence"],
};
