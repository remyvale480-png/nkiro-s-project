export type CurriculumId =
  | "US_COMMON_CORE"
  | "UK_GCSE_ALEVEL"
  | "IB"
  | "INDIA_CBSE"
  | "KENYA_KCSE"
  | "NIGERIA_WAEC";

export type NotationStyle = "point_obelus" | "comma_slash";

export type PikoMood = "idle" | "thinking" | "cheering" | "encouraging" | "offline";

export type VerificationStatus = "verified" | "unverified" | "mismatch";

export interface SolutionStep {
  stepNumber: number;
  expressionLatex: string;
  expressionPlain: string;
  why: string;
}

export interface HintLadder {
  nudge: string;
  biggerHint: string;
  nextStep: string;
}

export interface SolveResult {
  id: string;
  normalizedProblem: string;
  problemLatex: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  curriculumTags: string[];
  pikoGreeting: string;
  steps: SolutionStep[];
  finalAnswerLatex: string;
  finalAnswerPlain: string;
  hints: HintLadder;
  confidence: number;
  verificationStatus: VerificationStatus;
  verificationMessage: string;
  modelUsed: string;
  cached: boolean;
  remainingQuota: number;
}

export interface RecognizeResult {
  recognizedPlain: string;
  recognizedLatex: string;
  confidence: number;
  notes?: string;
}
