import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Independent horizontal rail: drag never activates the item underneath it. */
export function DragScroll({
  children,
  label,
  className = "",
  followKey,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  followKey: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef({ id: -1, x: 0, y: 0, left: 0, moved: false });
  useLayoutEffect(() => {
    const rail = ref.current,
      target = rail?.querySelector<HTMLElement | SVGElement>(`[data-follow="${followKey}"]`);
    if (!rail || !target || gesture.current.id !== -1) return;
    const bounds = rail.getBoundingClientRect(),
      item = target.getBoundingClientRect(),
      margin = 24;
    if (item.left < bounds.left + margin) rail.scrollLeft += item.left - bounds.left - margin;
    else if (item.right > bounds.right - margin)
      rail.scrollLeft += item.right - bounds.right + margin;
  }, [followKey]);
  return (
    <div
      ref={ref}
      className={`drag-scroll ${className}`}
      role="region"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        gesture.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          left: e.currentTarget.scrollLeft,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (g.id !== e.pointerId) return;
        const dx = e.clientX - g.x;
        if (!g.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - g.y)) {
          g.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.dataset.dragging = "true";
        }
        if (g.moved) {
          e.preventDefault();
          e.currentTarget.scrollLeft = g.left - dx;
        }
      }}
      onPointerUp={(e) => {
        if (gesture.current.id === e.pointerId) {
          gesture.current.id = -1;
          delete e.currentTarget.dataset.dragging;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={(e) => {
        gesture.current.id = -1;
        gesture.current.moved = true;
        delete e.currentTarget.dataset.dragging;
      }}
      onClickCapture={(e) => {
        if (gesture.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          gesture.current.moved = false;
        }
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          e.currentTarget.scrollLeft += (e.key === "ArrowRight" ? 1 : -1) * 200;
        } else if (e.key === "Home") {
          e.preventDefault();
          e.currentTarget.scrollLeft = 0;
        } else if (e.key === "End") {
          e.preventDefault();
          e.currentTarget.scrollLeft = e.currentTarget.scrollWidth;
        }
      }}
    >
      {children}
    </div>
  );
}
