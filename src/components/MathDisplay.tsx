import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathDisplayProps {
  latex: string;
  fallback?: string;
  displayMode?: boolean;
  className?: string;
}

export const MathDisplay: React.FC<MathDisplayProps> = ({
  latex,
  fallback,
  displayMode = false,
  className = "",
}) => {
  const html = useMemo(() => {
    const input = (latex || fallback || "").trim();
    if (!input) return "";
    try {
      return katex.renderToString(input, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return "";
    }
  }, [latex, fallback, displayMode]);

  if (!html) {
    return (
      <span className={`font-mono text-sm ${className}`}>
        {fallback || latex}
      </span>
    );
  }

  return (
    <span
      className={`inline-block max-w-full overflow-x-auto align-middle ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
