import { useId } from "react";
import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import "./Slider.css";

export function Slider({
  label,
  value,
  min = 0,
  max,
  step = 1,
  formatValue = String,
  startLabel,
  endLabel,
  description,
  disabled = false,
  adjustable = false,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  startLabel?: string;
  endLabel?: string;
  description?: string;
  disabled?: boolean;
  adjustable?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const progress = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="slider-field" data-disabled={disabled}>
      <div className="slider-heading">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{formatValue(value)}</output>
      </div>
      <div className="slider-track-row">
        {adjustable && (
          <button
            type="button"
            className="slider-adjust"
            aria-label={`降低${label}`}
            title="减少 1；按住 Shift 减少 5"
            disabled={disabled || value <= min}
            onClick={(event) => onChange(Math.max(min, value - step * (event.shiftKey ? 5 : 1)))}
          >
            <Minus size={16} />
          </button>
        )}
        <input
          id={id}
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={formatValue(value)}
          aria-describedby={description ? `${id}-description` : undefined}
          style={{ "--slider-progress": `${progress}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {adjustable && (
          <button
            type="button"
            className="slider-adjust"
            aria-label={`提高${label}`}
            title="增加 1；按住 Shift 增加 5"
            disabled={disabled || value >= max}
            onClick={(event) => onChange(Math.min(max, value + step * (event.shiftKey ? 5 : 1)))}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      {(startLabel || endLabel) && (
        <div className="slider-scale" aria-hidden="true">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
      {description && (
        <p id={`${id}-description`} className="hint">
          {description}
        </p>
      )}
    </div>
  );
}
