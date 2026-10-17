import { useEffect, useId, useRef, useState } from "react";
import { TempoSlider } from "./TempoSlider";

export function PlaybackTempo({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={root}
      className="playback-tempo"
      data-tempo-control
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="tempo-display"
        aria-label={`播放速度 ${value} BPM，调整速度`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <span>{value}</span>
        <small>BPM</small>
      </button>
      {open && (
        <div id={id} role="dialog" aria-label="调整播放速度" className="tempo-popover">
          <TempoSlider value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
