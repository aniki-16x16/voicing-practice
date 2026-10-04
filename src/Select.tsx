import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, height: 220 });
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = () => {
    const r = trigger.current!.getBoundingClientRect(),
      height = Math.min(240, options.length * 40 + 10);
    const below = window.innerHeight - r.bottom - 12,
      above = r.top - 12;
    const useAbove = below < Math.min(height, 160) && above > below;
    const available = Math.min(height, useAbove ? above : below);
    setPosition({
      left: r.left,
      top: useAbove ? r.top - available - 5 : r.bottom + 5,
      width: r.width,
      height: available,
    });
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="select-field" ref={root}>
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className={`select-trigger ${open ? "expanded" : ""}`}
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(e) => {
          if (!root.current?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
          if (e.key === "Tab") {
            setOpen(false);
            return;
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) {
              show();
              return;
            }
            setActive((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? options.length - 1
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length,
            );
          } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            choose(active);
          } else if (e.key.length === 1 && e.key !== " ") {
            const found = options.findIndex(
              (o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (found >= 0) {
              if (!open) show();
              setActive(found);
            }
          }
        }}
      >
        <span>{options.find((o) => o.value === value)?.label || "—"}</span>
        <ChevronDown className="chevron" size={16} />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-list`}
          className="select-menu"
          role="listbox"
          aria-labelledby={`${id}-label`}
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.height,
          }}
        >
          {options.map((o, i) => (
            <div
              id={`${id}-${i}`}
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              className={`select-option ${active === i ? "focused" : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {value === o.value && <Check size={15} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
