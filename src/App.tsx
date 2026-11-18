import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Keyboard,
  Moon,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { CameraSnapPanel } from "./components/CameraSnapPanel.tsx";
import { DrawingCanvas } from "./components/DrawingCanvas.tsx";
import { MathDisplay } from "./components/MathDisplay.tsx";
import { MathKeyboard } from "./components/MathKeyboard.tsx";
import { PikoMascot } from "./components/PikoMascot.tsx";
import { ShareSolutionMenu } from "./components/ShareSolutionMenu.tsx";
import type {
  CurriculumId,
  NotationStyle,
  PikoMood,
  RecognizeResult,
  SolveResult,
} from "./shared/types.ts";

type InputMode = "type" | "snap" | "draw";

const CURRICULA: Array<{ id: CurriculumId; label: string; defaultGrade: string }> = [
  { id: "US_COMMON_CORE", label: "US Common Core", defaultGrade: "Grade 8" },
  { id: "UK_GCSE_ALEVEL", label: "UK GCSE / A-Level", defaultGrade: "Year 10" },
  { id: "IB", label: "IB Mathematics", defaultGrade: "MYP 4 / DP" },
  { id: "INDIA_CBSE", label: "India CBSE / NCERT", defaultGrade: "Class 9" },
  { id: "KENYA_KCSE", label: "Kenya KCSE / CBC", defaultGrade: "Form 2" },
  { id: "NIGERIA_WAEC", label: "Nigeria WAEC", defaultGrade: "SS2" },
];

const SAMPLE_PROBLEMS = [
  { label: "2x + 5 = 17", expr: "2x + 5 = 17" },
  { label: "x² − 5x + 6 = 0", expr: "x^2 - 5x + 6 = 0" },
  { label: "3/4 + 5/6", expr: "\\frac{3}{4} + \\frac{5}{6}" },
  { label: "d/dx (3x² + 4x)", expr: "d/dx (3x^2 + 4x)" },
];

function getOrCreateClientId(): string {
  const key = "piko_client_id";
  let existing = localStorage.getItem(key);
  if (!existing) {
    existing = `web_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, existing);
  }
  return existing;
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("piko_theme") === "dark";
    }
    return false;
  });

  const [inputMode, setInputMode] = useState<InputMode>("type");
  const [problemInput, setProblemInput] = useState<string>("2x + 5 = 17");
  const [curriculum, setCurriculum] = useState<CurriculumId>("US_COMMON_CORE");
  const [gradeLevel, setGradeLevel] = useState<string>("Grade 8");
  const [notation, setNotation] = useState<NotationStyle>("point_obelus");

  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [recognizeNote, setRecognizeNote] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolveResult | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("piko_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("piko_theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    fetch("/api/quota", {
      headers: { "x-piko-client-id": getOrCreateClientId() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.remaining === "number") {
          setRemainingQuota(data.remaining);
        }
      })
      .catch(() => {});
  }, []);

  // Hydrate shared solution link (?share=... or ?p=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    const paramProblem = params.get("p");
    const paramCurr = params.get("c") as CurriculumId | null;
    const paramNot = params.get("n") as NotationStyle | null;

    if (paramCurr && CURRICULA.some((c) => c.id === paramCurr)) {
      handleCurriculumChange(paramCurr);
    }
    if (paramNot === "point_obelus" || paramNot === "comma_slash") {
      setNotation(paramNot);
    }

    if (shareId) {
      fetch(`/api/solutions/${encodeURIComponent(shareId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.solution) {
            setSolution(data.solution as SolveResult);
            setProblemInput(data.solution.normalizedProblem);
            if (data.curriculum) handleCurriculumChange(data.curriculum);
            if (data.notation) setNotation(data.notation);
          } else if (paramProblem) {
            setProblemInput(paramProblem);
            handleSolve(paramProblem);
          }
        })
        .catch(() => {
          if (paramProblem) {
            setProblemInput(paramProblem);
          }
        });
    } else if (paramProblem) {
      setProblemInput(paramProblem);
      handleSolve(paramProblem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCurriculumChange = (nextId: CurriculumId) => {
    setCurriculum(nextId);
    const found = CURRICULA.find((c) => c.id === nextId);
    if (found) setGradeLevel(found.defaultGrade);
  };

  const handleRecognizeImage = async (
    imageBase64: string,
    mimeType: string,
    source: "camera" | "handwriting"
  ) => {
    setIsRecognizing(true);
    setRecognizeNote(null);
    setErrorMessage(null);
    try {
      const resp = await fetch("/api/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-piko-client-id": getOrCreateClientId(),
        },
        body: JSON.stringify({ imageBase64, mimeType, source }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not read math from that image.");
      }
      const parsed = data as RecognizeResult;
      const nextText = parsed.recognizedLatex || parsed.recognizedPlain;
      if (nextText) {
        setProblemInput(nextText);
      }
      setRecognizeNote(
        parsed.notes ||
          `Recognized with ${Math.round((parsed.confidence || 0.9) * 100)}% certainty. Check or edit before solving.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not read that image."
      );
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSolve = async (overrideProblem?: string) => {
    const textToSolve = (overrideProblem ?? problemInput).trim();
    if (!textToSolve) {
      setErrorMessage("Type, draw, or snap a math problem first.");
      return;
    }

    setIsSolving(true);
    setErrorMessage(null);
    setCopiedAnswer(false);
    try {
      const resp = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-piko-client-id": getOrCreateClientId(),
        },
        body: JSON.stringify({
          problem: textToSolve,
          curriculum,
          gradeLevel,
          notation,
          language: "en",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (typeof data.remainingQuota === "number") {
          setRemainingQuota(data.remainingQuota);
        }
        throw new Error(data.error || "Piko could not solve this problem right now.");
      }
      const solved = data as SolveResult;
      setSolution(solved);
      setRemainingQuota(solved.remainingQuota);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error while solving."
      );
    } finally {
      setIsSolving(false);
    }
  };

  const handleCopyAnswer = () => {
    if (!solution) return;
    navigator.clipboard?.writeText(solution.finalAnswerPlain);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 1800);
  };

  const pikoMood: PikoMood = isSolving || isRecognizing
    ? "thinking"
    : errorMessage
    ? "encouraging"
    : solution
    ? solution.verificationStatus === "verified"
      ? "cheering"
      : "encouraging"
    : "idle";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-violet-700 dark:text-violet-400 whitespace-nowrap shrink-0"
          >
            Piko Math
          </a>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setInputMode("type")}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                inputMode === "type" ? "text-violet-700 dark:text-violet-400 font-semibold" : ""
              }`}
            >
              Type
            </button>
            <button
              type="button"
              onClick={() => setInputMode("snap")}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                inputMode === "snap" ? "text-violet-700 dark:text-violet-400 font-semibold" : ""
              }`}
            >
              Snap
            </button>
            <button
              type="button"
              onClick={() => setInputMode("draw")}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                inputMode === "draw" ? "text-violet-700 dark:text-violet-400 font-semibold" : ""
              }`}
            >
              Draw
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{darkMode ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Intro & Curriculum Row */}
        <section className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <PikoMascot mood={pikoMood} size={60} />
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Math, one step at a time.
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Snap, draw, or type your problem. Piko verifies the math before showing every step.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Curriculum</span>
              <select
                value={curriculum}
                onChange={(e) => handleCurriculumChange(e.target.value as CurriculumId)}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
              >
                {CURRICULA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Notation</span>
              <select
                value={notation}
                onChange={(e) => setNotation(e.target.value as NotationStyle)}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="point_obelus">3.5 · a ÷ b</option>
                <option value="comma_slash">3,5 · a / b</option>
              </select>
            </label>
          </div>
        </section>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Input Studio */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            {/* Mode Switcher */}
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
              role="tablist"
              aria-label="Math input method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === "type"}
                onClick={() => setInputMode("type")}
                className={`min-h-[44px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  inputMode === "type"
                    ? "bg-white dark:bg-slate-950 text-violet-700 dark:text-violet-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Keyboard className="w-4 h-4" />
                Type
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === "snap"}
                onClick={() => setInputMode("snap")}
                className={`min-h-[44px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  inputMode === "snap"
                    ? "bg-white dark:bg-slate-950 text-violet-700 dark:text-violet-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Camera className="w-4 h-4" />
                Snap
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === "draw"}
                onClick={() => setInputMode("draw")}
                className={`min-h-[44px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  inputMode === "draw"
                    ? "bg-white dark:bg-slate-950 text-violet-700 dark:text-violet-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <PenTool className="w-4 h-4" />
                Draw
              </button>
            </div>

            {/* Active Mode Panel */}
            {inputMode === "snap" && (
              <CameraSnapPanel
                isRecognizing={isRecognizing}
                onRecognize={(img, mime) =>
                  handleRecognizeImage(img, mime, "camera")
                }
              />
            )}

            {inputMode === "draw" && (
              <DrawingCanvas
                isRecognizing={isRecognizing}
                onRecognize={(img) =>
                  handleRecognizeImage(img, "image/png", "handwriting")
                }
              />
            )}

            {/* Editable Rendered Math Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <label htmlFor="problem-editor" className="font-semibold">
                  Check or edit your problem
                </label>
                {remainingQuota !== null && (
                  <span className="font-mono tabular-nums">
                    {remainingQuota} free solves left today
                  </span>
                )}
              </div>

              {/* Live KaTeX Preview Box */}
              <div className="min-h-[56px] px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-lg">
                {problemInput.trim() ? (
                  <MathDisplay latex={problemInput} fallback={problemInput} />
                ) : (
                  <span className="text-sm text-slate-400">
                    Your rendered math appears here
                  </span>
                )}
              </div>

              <input
                id="problem-editor"
                type="text"
                value={problemInput}
                onChange={(e) => setProblemInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSolve();
                }}
                placeholder="e.g. 2x + 5 = 17 or \frac{3}{4} + \frac{5}{6}"
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
              />

              {recognizeNote && (
                <p className="text-xs text-teal-700 dark:text-teal-400">
                  {recognizeNote}
                </p>
              )}
            </div>

            {inputMode === "type" && (
              <MathKeyboard
                notation={notation}
                onInsert={(token) => setProblemInput((prev) => prev + token)}
                onBackspace={() => setProblemInput((prev) => prev.slice(0, -1))}
                onClear={() => setProblemInput("")}
              />
            )}

            <button
              type="button"
              onClick={() => handleSolve()}
              disabled={isSolving || isRecognizing || !problemInput.trim()}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {isSolving ? "Piko is solving…" : "Solve with Piko"}
            </button>

            {/* Quick Sample Problems */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Try a sample problem
              </p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PROBLEMS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setProblemInput(sample.expr);
                      setInputMode("type");
                      handleSolve(sample.expr);
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-xs font-mono text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: Verified Step-by-Step Solution */}
          <section className="lg:col-span-7 space-y-4">
            {isSolving ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
                <PikoMascot mood="thinking" size={72} className="mx-auto" />
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    Working through the steps…
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Piko is writing clear explanations and checking the final answer symbolically.
                  </p>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <PikoMascot mood="encouraging" size={56} />
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                      Let&apos;s try that again
                    </h2>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSolve()}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry solve
                </button>
              </div>
            ) : !solution ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                <PikoMascot mood="idle" size={72} className="mx-auto" />
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Ready when you are
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Enter a problem on the left or pick a sample. You&apos;ll get numbered steps with a short &ldquo;Why?&rdquo; for each move and a symbolically verified answer.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Piko Header & Verification Status */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <PikoMascot mood={pikoMood} size={52} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {solution.pikoGreeting}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>{solution.topic}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{solution.difficulty}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{solution.steps.length} steps</span>
                          {solution.cached && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Cached verified</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <ShareSolutionMenu
                      solution={solution}
                      curriculum={curriculum}
                      notation={notation}
                    />
                  </div>

                  {/* Verification Indicator (Icon + Explicit Text, never hue-only) */}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 ${
                      solution.verificationStatus === "verified"
                        ? "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-900"
                        : "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                    }`}
                  >
                    {solution.verificationStatus === "verified" ? (
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{solution.verificationMessage}</span>
                  </div>

                  {/* Problem Statement */}
                  <div className="pt-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Problem
                    </p>
                    <div className="text-lg font-medium text-slate-900 dark:text-white">
                      <MathDisplay
                        latex={solution.problemLatex}
                        fallback={solution.normalizedProblem}
                      />
                    </div>
                  </div>
                </div>

                {/* Numbered Step-by-Step Cards */}
                <div className="space-y-3">
                  {solution.steps.map((step) => (
                    <article
                      key={step.stepNumber}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 tabular-nums">
                          Step {step.stepNumber}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg text-slate-900 dark:text-white overflow-x-auto">
                        <MathDisplay
                          latex={step.expressionLatex}
                          fallback={step.expressionPlain}
                        />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          Why?{" "}
                        </span>
                        {step.why}
                      </p>
                    </article>
                  ))}
                </div>

                {/* Final Answer Card */}
                <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                      Final Answer
                    </p>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      <MathDisplay
                        latex={solution.finalAnswerLatex}
                        fallback={solution.finalAnswerPlain}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAnswer}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-teal-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-center"
                  >
                    {copiedAnswer ? (
                      <>
                        <Check className="w-4 h-4 text-teal-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy answer
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
