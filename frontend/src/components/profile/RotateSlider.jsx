import React from "react";
import { RotateCcw, RotateCw } from "lucide-react";

export const RotateSlider = React.memo(({ value, onChange, min = 0, max = 360, step = 1 }) => {
  return (
    <div className="flex items-center gap-3 w-full">
      <button
        type="button"
        onClick={() => onChange((value - 90 + 360) % 360)}
        className="text-slate-500 hover:text-violet-500 transition-colors focus:outline-none"
        aria-label="Rotate 90 degrees counter-clockwise"
      >
        <RotateCcw size={16} />
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
        aria-label="Rotation slider"
      />
      <button
        type="button"
        onClick={() => onChange((value + 90) % 360)}
        className="text-slate-500 hover:text-violet-500 transition-colors focus:outline-none"
        aria-label="Rotate 90 degrees clockwise"
      >
        <RotateCw size={16} />
      </button>
    </div>
  );
});

export default RotateSlider;
