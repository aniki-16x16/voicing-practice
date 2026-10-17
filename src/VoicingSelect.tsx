import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { Settings } from "./music";

const labels = { root: "根音", shell: "Shell", free: "自由配音" };
export function VoicingSelect({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hand, setHand] = useState<"left" | "right">("right");
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const left = settings.leftMode ?? "root";
  const right = settings.preset === "shell" ? "shell" : "free";
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')
      ?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const scroll = (event: Event) => {
      if (event.target instanceof Node && trigger.current && event.target.contains(trigger.current))
        close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <div
      className="voicing-controls"
      ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget)) setOpen(false);
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
      <div className="select-field">
        <span id={`${id}-label`}>Voicing</span>
        <button
          ref={trigger}
          className={`select-trigger ${open ? "expanded" : ""}`}
          disabled={settings.soloLeft}
          aria-labelledby={`${id}-label`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => {
            const bounds = root.current!.getBoundingClientRect();
            const button = trigger.current!.getBoundingClientRect();
            setPosition({
              left: bounds.left,
              width: bounds.width,
              top: Math.max(8, Math.min(button.bottom + 5, window.innerHeight - 258)),
            });
            setOpen(!open);
          }}
        >
          <span>
            {settings.soloLeft
              ? "左：Shell · 右：关闭"
              : `左：${labels[left]} · 右：${labels[right]}`}
          </span>
          <ChevronDown size={16} />
        </button>
      </div>
      <label className="solo-left-control">
        <input
          type="checkbox"
          checked={!!settings.soloLeft}
          onChange={(event) => {
            setOpen(false);
            onChange({ soloLeft: event.target.checked });
          }}
        />
        <span>单练左手</span>
      </label>
      {open && (
        <div
          ref={menu}
          id={id}
          role="dialog"
          aria-label="左右手配音"
          className="select-menu voicing-menu"
          style={position}
        >
          <div
            className="hand-tabs"
            data-hand={hand}
            role="radiogroup"
            aria-label="编辑哪只手"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "left"
                  : event.key === "End"
                    ? "right"
                    : hand === "left"
                      ? "right"
                      : "left";
              setHand(next);
              event.currentTarget
                .querySelector<HTMLButtonElement>(`[data-hand="${next}"]`)
                ?.focus({ preventScroll: true });
            }}
          >
            <span className="hand-slider" aria-hidden="true" />
            {(["left", "right"] as const).map((value) => (
              <button
                type="button"
                key={value}
                role="radio"
                data-hand={value}
                aria-checked={hand === value}
                tabIndex={hand === value ? 0 : -1}
                onClick={() => setHand(value)}
              >
                {value === "left" ? "左手" : "右手"}
              </button>
            ))}
          </div>
          <div className="hand-options" aria-label={`${hand === "left" ? "左手" : "右手"}配音类型`}>
            {([...(hand === "left" ? ["root" as const] : []), "shell", "free"] as const).map(
              (value) => (
                <button
                  key={`${hand}-${value}`}
                  className="select-option"
                  aria-pressed={(hand === "left" ? left : right) === value}
                  onClick={() => {
                    onChange(
                      hand === "left"
                        ? { leftMode: value }
                        : { preset: value === "shell" ? "shell" : "right-rich" },
                    );
                  }}
                >
                  <span>{labels[value]}</span>
                  {(hand === "left" ? left : right) === value && <Check size={15} />}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
