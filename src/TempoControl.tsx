import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const minimum = 40;
const maximum = 140;

export function TempoControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (tempo: number) => void;
}) {
  const [input, setInput] = useState({ tempo: value, text: String(value) });
  const draft = input.tempo === value ? input.text : String(value);
  const setDraft = (text: string, tempo = value) => setInput({ tempo, text });
  const commit = (text: string) => {
    const number = Number(text);
    const next =
      text.trim() && Number.isFinite(number)
        ? Math.max(minimum, Math.min(maximum, Math.round(number)))
        : value;
    setDraft(String(next), next);
    if (next !== value) onChange(next);
  };
  const adjust = (step: number) => commit(String(value + step));
  return (
    <div className="tempo-stepper" role="group" aria-label="播放速度">
      <button
        type="button"
        aria-label="降低速度"
        title="降低 1 BPM，Shift 点击降低 5 BPM"
        disabled={value <= minimum}
        onClick={(e) => adjust(e.shiftKey ? -5 : -1)}
      >
        <Minus size={15} />
      </button>
      <label className="tempo-value">
        <input
          type="number"
          inputMode="numeric"
          aria-label="速度 BPM"
          min={minimum}
          max={maximum}
          step="1"
          value={draft}
          title="输入速度后按 Enter；上下方向键微调，按住 Shift 每次调整 5 BPM"
          onChange={(e) => {
            const text = e.target.value;
            const next = Number(text);
            const valid =
              text.trim() && Number.isInteger(next) && next >= minimum && next <= maximum;
            setDraft(text, valid ? next : value);
            if (valid && next !== value) onChange(next);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setDraft(String(value));
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const base = draft.trim() && Number.isFinite(Number(draft)) ? Number(draft) : value;
              commit(String(base + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 1)));
            }
          }}
        />
        <span>BPM</span>
      </label>
      <button
        type="button"
        aria-label="提高速度"
        title="提高 1 BPM，Shift 点击提高 5 BPM"
        disabled={value >= maximum}
        onClick={(e) => adjust(e.shiftKey ? 5 : 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
