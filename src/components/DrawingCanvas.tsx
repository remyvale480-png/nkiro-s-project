import React, { useEffect, useRef, useState } from "react";
import { Eraser, Sparkles, Undo2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface DrawingCanvasProps {
  onRecognize: (imageBase64: string) => Promise<void>;
  isRecognizing: boolean;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  onRecognize,
  isRecognizing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const activeStrokeRef = useRef<Point[] | null>(null);

  const redraw = (allStrokes: Point[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle notebook grid
    ctx.strokeStyle = "#F1F5F9";
    ctx.lineWidth = 1;
    for (let x = 24; x < canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 24; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of allStrokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    redraw(strokes);
  }, [strokes]);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCoords(e);
    activeStrokeRef.current = [pt];
    redraw([...strokes, [pt]]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    const pt = getCoords(e);
    activeStrokeRef.current.push(pt);
    redraw([...strokes, activeStrokeRef.current]);
  };

  const handlePointerUp = () => {
    if (!activeStrokeRef.current) return;
    const completed = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, completed]);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const handleReadSketch = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;
    const dataUrl = canvas.toDataURL("image/png");
    await onRecognize(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={640}
          height={260}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-52 sm:h-60 touch-none cursor-crosshair block"
          aria-label="Handwriting math drawing pad"
        />
        {strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Write a math problem with your finger or mouse
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0 || isRecognizing}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0 || isRecognizing}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={handleReadSketch}
          disabled={strokes.length === 0 || isRecognizing}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {isRecognizing ? "Reading sketch…" : "Read handwriting"}
        </button>
      </div>
    </div>
  );
};
