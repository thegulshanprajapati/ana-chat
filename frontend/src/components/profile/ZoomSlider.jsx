import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export const ZoomSlider = React.memo(({ value, onChange, min = 1, max = 3, step = 0.05 }) => {
  return (
    <div className="flex items-center gap-3 w-full">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 0.2))}
        className="text-slate-500 hover:text-violet-500 transition-colors focus:outline-none"
        aria-label="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
        aria-label="Zoom slider"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 0.2))}
        className="text-slate-500 hover:text-violet-500 transition-colors focus:outline-none"
        aria-label="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
    </div>
  );
});

export default ZoomSlider;
