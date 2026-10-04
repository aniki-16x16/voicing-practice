import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}
type SelectProps = {
  label: string;
  options: Option[];
  showAll?: boolean;
  layout?: "list" | "tags";
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);
export function Select(props: SelectProps) {
  const { label, value, options, showAll = false, multiple = false, layout = "list" } = props;
  const selected = Array.isArray(value) ? value : [value];
  const clearable = multiple && selected.length > 0;
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, height: 220 });
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = () => {
    const r = trigger.current!.getBoundingClientRect(),
      height =
        layout === "tags"
          ? Math.min(280, window.innerHeight - 16)
          : showAll
            ? options.length * 32 + 10
            : Math.min(240, options.length * 40 + 10);
    const container =
      layout === "tags" ? root.current?.closest<HTMLElement>("[data-select-container]") : null;
    const containerBounds = container?.getBoundingClientRect();
    const containerStyle = container ? getComputedStyle(container) : null;
    const paddingLeft = containerStyle ? parseFloat(containerStyle.paddingLeft) : 0;
    const paddingRight = containerStyle ? parseFloat(containerStyle.paddingRight) : 0;
    const below = window.innerHeight - r.bottom - 12,
      above = r.top - 12;
    const useAbove = below < (showAll ? height : Math.min(height, 160)) && above > below;
    const available =
      layout === "tags"
        ? height
        : showAll
          ? Math.min(height, window.innerHeight - 16)
          : Math.min(height, useAbove ? above : below);
    setPosition({
      left:
        containerBounds && container
          ? containerBounds.left + container.clientLeft + paddingLeft
          : r.left,
      top: Math.max(
        8,
        Math.min(
          window.innerHeight - available - 8,
          useAbove ? r.top - available - 5 : r.bottom + 5,
        ),
      ),
      width: container ? container.clientWidth - paddingLeft - paddingRight : r.width,
      height: available,
    });
    setActive(
      Math.max(
        0,
        options.findIndex((o) => selected.includes(o.value)),
      ),
    );
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || layout !== "tags" || !menu.current || !trigger.current) return;
    // tag 换行后按实际高度定位，仍优先贴近触发控件，并留在视口内。
    const update = () => {
      if (!menu.current || !trigger.current) return;
      const r = trigger.current.getBoundingClientRect();
      const height = Math.min(menu.current.scrollHeight + 2, 280);
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const useAbove = below < height && above > below;
      const available = Math.max(0, Math.min(height, useAbove ? above : below));
      const top = Math.max(
        8,
        Math.min(
          window.innerHeight - available - 8,
          useAbove ? r.top - available - 5 : r.bottom + 5,
        ),
      );
      setPosition((previous) =>
        previous.top === top && previous.height === available
          ? previous
          : { ...previous, top, height: available },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    // 多选内容换行导致控件变高时，菜单随之重新贴齐。
    observer.observe(trigger.current);
    const container = root.current?.closest("[data-select-container]");
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [open, layout]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const scroll = (e: Event) => {
      // 只在触发按钮所在容器滚动时关闭；背景谱表的平滑跟随不影响菜单位置。
      if (e.target instanceof Node && trigger.current && e.target.contains(trigger.current))
        close();
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
    const list = menu.current;
    const option = list?.children[active] as HTMLElement | undefined;
    if (!open || showAll || !list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [active, open, showAll]);
  const choose = (index: number) => {
    const next = options[index].value;
    if (props.multiple) {
      props.onChange(
        props.value.includes(next)
          ? props.value.filter((value) => value !== next)
          : [...props.value, next],
      );
      setActive(index);
    } else {
      props.onChange(next);
      setOpen(false);
    }
    trigger.current?.focus();
  };
  return (
    <div className="select-field" ref={root}>
      <span id={`${id}-label`}>{label}</span>
      <div className="select-control">
        <button
          ref={trigger}
          type="button"
          className={`select-trigger ${open ? "expanded" : ""} ${clearable ? "clearable" : ""}`}
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
            if (
              [
                "ArrowDown",
                "ArrowUp",
                "Home",
                "End",
                ...(layout === "tags" ? ["ArrowLeft", "ArrowRight"] : []),
              ].includes(e.key)
            ) {
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
                    : (i +
                        (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) +
                        options.length) %
                      options.length,
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
          <span>
            {multiple
              ? selected.length
                ? options
                    .filter((o) => selected.includes(o.value))
                    .map((o) => o.value.replaceAll("b", "♭").replaceAll("#", "♯"))
                    .join("、")
                : "无"
              : options.find((o) => o.value === value)?.label || "—"}
          </span>
          {!clearable && <ChevronDown className="chevron" size={16} />}
        </button>
        {clearable && (
          <button
            type="button"
            className="select-clear"
            aria-label={`清空${label}`}
            title={`清空${label}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              if (props.multiple) props.onChange([]);
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <div
          ref={menu}
          id={`${id}-list`}
          className={`select-menu ${showAll ? "show-all" : ""} ${layout === "tags" ? "tag-menu" : ""}`}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          aria-orientation={layout === "tags" ? "horizontal" : undefined}
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
              aria-selected={selected.includes(o.value)}
              className={`select-option ${layout === "tags" ? "tag-option" : ""} ${active === i ? "focused" : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {selected.includes(o.value) && <Check size={15} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
