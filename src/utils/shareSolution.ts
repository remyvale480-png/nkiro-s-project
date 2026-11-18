import type { CurriculumId, NotationStyle, SolveResult } from "../shared/types.ts";

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMiniPiko(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Soft circle background
  ctx.fillStyle = "rgba(109, 40, 217, 0.12)";
  ctx.beginPath();
  ctx.arc(50, 52, 44, 0, Math.PI * 2);
  ctx.fill();

  // Pi crossbar
  ctx.fillStyle = "#6D28D9";
  drawRoundedRect(ctx, 16, 22, 70, 20, 10);
  ctx.fill();

  // Legs
  ctx.strokeStyle = "#6D28D9";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(36, 39);
  ctx.quadraticCurveTo(33, 66, 25, 81);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(64, 39);
  ctx.quadraticCurveTo(63, 73, 76, 79);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(40, 32, 6, 0, Math.PI * 2);
  ctx.arc(62, 32, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.arc(40.5, 32, 3, 0, Math.PI * 2);
  ctx.arc(62.5, 32, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function buildShareableLink(
  solution: SolveResult,
  curriculum: CurriculumId,
  notation: NotationStyle
): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("share", solution.id);
  url.searchParams.set("p", solution.normalizedProblem);
  url.searchParams.set("c", curriculum);
  url.searchParams.set("n", notation);
  return url.toString();
}

export async function renderSolutionToPngBlob(solution: SolveResult): Promise<Blob> {
  const width = 960;
  const pad = 44;
  const contentWidth = width - pad * 2;
  const innerWidth = contentWidth - 44;

  // Measure layout using a scratch canvas context
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;

  mctx.font = "600 24px 'IBM Plex Mono', monospace";
  const problemLines = wrapTextLines(mctx, solution.normalizedProblem, innerWidth);

  const stepLayouts = solution.steps.map((step) => {
    mctx.font = "600 22px 'IBM Plex Mono', monospace";
    const exprLines = wrapTextLines(
      mctx,
      step.expressionPlain || step.expressionLatex,
      innerWidth
    );
    mctx.font = "400 18px 'Plus Jakarta Sans', sans-serif";
    const whyLines = wrapTextLines(mctx, `Why? ${step.why}`, innerWidth);
    const height = 44 + exprLines.length * 30 + whyLines.length * 26 + 22;
    return { step, exprLines, whyLines, height };
  });

  mctx.font = "700 28px 'IBM Plex Mono', monospace";
  const answerLines = wrapTextLines(mctx, solution.finalAnswerPlain, innerWidth);

  const headerHeight = 104;
  const problemBoxHeight = 52 + problemLines.length * 32;
  const stepsTotalHeight = stepLayouts.reduce((acc, s) => acc + s.height + 14, 0);
  const answerBoxHeight = 62 + answerLines.length * 36;
  const footerHeight = 52;

  const totalHeight =
    pad +
    headerHeight +
    18 +
    problemBoxHeight +
    20 +
    stepsTotalHeight +
    8 +
    answerBoxHeight +
    24 +
    footerHeight +
    pad;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Canvas background
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, width, totalHeight);

  let y = pad;

  // Header
  drawMiniPiko(ctx, pad, y + 4, 62);
  ctx.fillStyle = "#6D28D9";
  ctx.font = "700 28px 'Outfit', sans-serif";
  ctx.fillText("Piko Math", pad + 78, y + 32);

  ctx.fillStyle = "#475569";
  ctx.font = "500 16px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(
    `${solution.topic} · ${solution.difficulty} · ${solution.steps.length} steps`,
    pad + 78,
    y + 58
  );

  const verifiedText =
    solution.verificationStatus === "verified"
      ? "Verified answer"
      : "Check steps carefully";
  ctx.font = "600 15px 'Plus Jakarta Sans', sans-serif";
  const badgeW = ctx.measureText(verifiedText).width + 28;
  ctx.fillStyle =
    solution.verificationStatus === "verified" ? "#CCFBF1" : "#FEF3C7";
  drawRoundedRect(ctx, width - pad - badgeW, y + 14, badgeW, 34, 10);
  ctx.fill();
  ctx.fillStyle =
    solution.verificationStatus === "verified" ? "#0F766E" : "#B45309";
  ctx.fillText(verifiedText, width - pad - badgeW + 14, y + 36);

  y += headerHeight;

  // Divider
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 18;

  // Problem card
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, y, contentWidth, problemBoxHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "600 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Problem", pad + 22, y + 26);

  ctx.fillStyle = "#0F172A";
  ctx.font = "600 24px 'IBM Plex Mono', monospace";
  problemLines.forEach((line, idx) => {
    ctx.fillText(line, pad + 22, y + 58 + idx * 32);
  });

  y += problemBoxHeight + 20;

  // Step cards
  for (const item of stepLayouts) {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, pad, y, contentWidth, item.height, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6D28D9";
    ctx.font = "700 14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(`Step ${item.step.stepNumber}`, pad + 22, y + 26);

    ctx.fillStyle = "#0F172A";
    ctx.font = "600 22px 'IBM Plex Mono', monospace";
    let sy = y + 58;
    for (const line of item.exprLines) {
      ctx.fillText(line, pad + 22, sy);
      sy += 30;
    }

    ctx.fillStyle = "#334155";
    ctx.font = "400 18px 'Plus Jakarta Sans', sans-serif";
    sy += 4;
    for (const line of item.whyLines) {
      ctx.fillText(line, pad + 22, sy);
      sy += 26;
    }

    y += item.height + 14;
  }

  y += 8;

  // Final Answer card
  ctx.fillStyle = "#F0FDFA";
  ctx.strokeStyle = "#99F6E4";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, y, contentWidth, answerBoxHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0F766E";
  ctx.font = "700 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Final Answer", pad + 22, y + 28);

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 28px 'IBM Plex Mono', monospace";
  answerLines.forEach((line, idx) => {
    ctx.fillText(line, pad + 22, y + 64 + idx * 36);
  });

  y += answerBoxHeight + 24;

  // Footer
  ctx.fillStyle = "#64748B";
  ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Piko Math · Math, one step at a time.", pad, y + 22);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render solution image."));
    }, "image/png");
  });
}

export async function copySolutionImageToClipboard(
  solution: SolveResult
): Promise<"copied" | "downloaded"> {
  const blob = await renderSolutionToPngBlob(solution);

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return "copied";
    } catch {
      // Fallback to PNG download if clipboard image write is blocked by permissions/iframe
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `piko-solution-${solution.id}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
