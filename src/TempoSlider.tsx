import { Slider } from "./Slider";
import { minimumTempo, maximumTempo } from "./settings";

export function TempoSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div data-tempo-control>
      <Slider
        label="播放速度"
        value={value}
        min={minimumTempo}
        max={maximumTempo}
        formatValue={(tempo) => `${tempo} BPM`}
        startLabel={String(minimumTempo)}
        endLabel={String(maximumTempo)}
        adjustable
        onChange={onChange}
      />
    </div>
  );
}
