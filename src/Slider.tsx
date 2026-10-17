import { useId } from "react";
import type { CSSProperties } from "react";
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
