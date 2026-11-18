import React from "react";
import type { PikoMood } from "../shared/types.ts";

interface PikoMascotProps {
  mood: PikoMood;
  size?: number;
  className?: string;
}

const MOOD_LABELS: Record<PikoMood, string> = {
  idle: "Piko is ready",
  thinking: "Piko is thinking through the problem",
  cheering: "Piko is cheering for your verified solution",
  encouraging: "Piko encourages you to check carefully",
  offline: "Piko is offline",
};

export const PikoMascot: React.FC<PikoMascotProps> = ({
  mood,
  size = 56,
  className = "",
}) => {
  const isThinking = mood === "thinking";
  const isCheering = mood === "cheering";
  const isEncouraging = mood === "encouraging";
  const isOffline = mood === "offline";

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none ${
        isThinking ? "animate-bounce" : ""
      } ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={MOOD_LABELS[mood]}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft aura behind Piko */}
        <circle
          cx="50"
          cy="52"
          r="42"
          className={
            isCheering
              ? "fill-teal-500/15 dark:fill-teal-400/15"
              : isEncouraging
              ? "fill-amber-500/15 dark:fill-amber-400/15"
              : "fill-violet-600/10 dark:fill-violet-400/15"
          }
        />

        {/* Piko pi crossbar */}
        <path
          d="M16 32C16 26.477 20.477 22 26 22H76C81.523 22 86 26.477 86 32C86 37.523 81.523 42 76 42H26C20.477 42 16 37.523 16 32Z"
          className="fill-violet-600 dark:fill-violet-500"
        />

        {/* Left pi leg */}
        <path
          d="M36 39C35 55 32 71 25 81"
          strokeWidth="13"
          strokeLinecap="round"
          className="stroke-violet-600 dark:stroke-violet-500"
        />

        {/* Right pi leg with cheerful curve */}
        <path
          d="M64 39C63 59 64 76 74 79C77 80 80 78 82 75"
          strokeWidth="13"
          strokeLinecap="round"
          className="stroke-violet-600 dark:stroke-violet-500"
        />

        {/* Expressive eyes */}
        <circle cx="40" cy="32" r="6.5" fill="#FFFFFF" />
        <circle cx="62" cy="32" r="6.5" fill="#FFFFFF" />

        {isOffline ? (
          <>
            <path d="M36 32H44" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M58 32H66" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : isCheering ? (
          <>
            <path d="M36 33C37.5 29.5 42.5 29.5 44 33" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M58 33C59.5 29.5 64.5 29.5 66 33" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle
              cx={isThinking ? 42 : 40.5}
              cy={isThinking ? 30.5 : 32}
              r="3.2"
              fill="#0F172A"
            />
            <circle
              cx={isThinking ? 64 : 62.5}
              cy={isThinking ? 30.5 : 32}
              r="3.2"
              fill="#0F172A"
            />
            <circle cx="39" cy="30.5" r="1.1" fill="#FFFFFF" />
            <circle cx="61" cy="30.5" r="1.1" fill="#FFFFFF" />
          </>
        )}

        {/* Small friendly mouth under the crossbar */}
        {isCheering ? (
          <path
            d="M45 48C47.5 52 54.5 52 57 48"
            stroke="#0D9488"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        ) : isEncouraging ? (
          <path
            d="M46 50C49 48.5 53 48.5 56 50"
            stroke="#D97706"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </div>
  );
};
