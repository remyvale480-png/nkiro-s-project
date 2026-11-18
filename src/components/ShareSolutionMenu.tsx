import React, { useEffect, useRef, useState } from "react";
import { Check, Download, Image as ImageIcon, Link2, Share2 } from "lucide-react";
import type { CurriculumId, NotationStyle, SolveResult } from "../shared/types.ts";
import {
  buildShareableLink,
  copySolutionImageToClipboard,
} from "../utils/shareSolution.ts";

interface ShareSolutionMenuProps {
  solution: SolveResult;
  curriculum: CurriculumId;
  notation: NotationStyle;
}

export const ShareSolutionMenu: React.FC<ShareSolutionMenuProps> = ({
  solution,
  curriculum,
  notation,
}) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "link-copied" | "image-copied" | "image-downloaded" | "busy"
  >("idle");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleCopyLink = async () => {
    const shareUrl = buildShareableLink(solution, curriculum, notation);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("link-copied");
      setTimeout(() => {
        setStatus("idle");
        setOpen(false);
      }, 1500);
    } catch {
      // Fallback selection copy
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setStatus("link-copied");
      setTimeout(() => {
        setStatus("idle");
        setOpen(false);
      }, 1500);
    }
  };

  const handleCopyImage = async () => {
    setStatus("busy");
    try {
      const outcome = await copySolutionImageToClipboard(solution);
      setStatus(outcome === "copied" ? "image-copied" : "image-downloaded");
      setTimeout(() => {
        setStatus("idle");
        setOpen(false);
      }, 1800);
    } catch {
      setStatus("idle");
    }
  };

  const buttonLabel =
    status === "link-copied"
      ? "Link copied"
      : status === "image-copied"
      ? "Image copied"
      : status === "image-downloaded"
      ? "Image saved"
      : "Share";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-violet-50 dark:hover:bg-violet-950/50 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
      >
        {status === "link-copied" || status === "image-copied" ? (
          <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        ) : status === "image-downloaded" ? (
          <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Share solution options"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5 z-40"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCopyLink}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 whitespace-nowrap transition-colors"
          >
            <Link2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span>
              {status === "link-copied" ? "Link copied to clipboard" : "Copy shareable link"}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={status === "busy"}
            onClick={handleCopyImage}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2.5 whitespace-nowrap transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>
              {status === "busy"
                ? "Rendering image…"
                : status === "image-copied"
                ? "Image copied to clipboard"
                : status === "image-downloaded"
                ? "PNG saved to device"
                : "Copy solution image"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
