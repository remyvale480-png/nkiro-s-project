import React from "react";
import { Delete } from "lucide-react";
import type { NotationStyle } from "../shared/types.ts";

interface MathKeyboardProps {
  notation: NotationStyle;
  onInsert: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export const MathKeyboard: React.FC<MathKeyboardProps> = ({
  notation,
  onInsert,
  onBackspace,
  onClear,
}) => {
  const divSymbol = notation === "comma_slash" ? "/" : "÷";
  const decimalSymbol = notation === "comma_slash" ? "," : ".";

  const keys: Array<{ label: string; insert: string; title: string }> = [
    { label: "a/b", insert: "\\frac{}{}", title: "Fraction" },
    { label: "x²", insert: "^2", title: "Square" },
    { label: "xⁿ", insert: "^", title: "Exponent" },
    { label: "√", insert: "\\sqrt{}", title: "Square root" },
    { label: "π", insert: "\\pi", title: "Pi" },
    { label: "∫", insert: "\\int ", title: "Integral" },
    { label: "sin", insert: "\\sin(", title: "Sine" },
    { label: "cos", insert: "\\cos(", title: "Cosine" },
    { label: "+", insert: "+", title: "Plus" },
    { label: "−", insert: "-", title: "Minus" },
    { label: "×", insert: "×", title: "Multiply" },
    { label: divSymbol, insert: divSymbol, title: "Divide" },
    { label: "=", insert: "=", title: "Equals" },
    { label: "(", insert: "(", title: "Open parenthesis" },
    { label: ")", insert: ")", title: "Close parenthesis" },
    { label: decimalSymbol, insert: decimalSymbol, title: "Decimal separator" },
    { label: "x", insert: "x", title: "Variable x" },
    { label: "y", insert: "y", title: "Variable y" },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-1.5">
        {keys.map((k) => (
          <button
            key={k.label}
            type="button"
            title={k.title}
            onClick={() => onInsert(k.insert)}
            className="min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/50 active:scale-[0.97] text-sm font-mono font-medium text-slate-900 dark:text-slate-100 transition-colors"
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onBackspace}
          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Delete className="w-4 h-4" />
          Backspace
        </button>
        <button
          type="button"
          onClick={onClear}
          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
