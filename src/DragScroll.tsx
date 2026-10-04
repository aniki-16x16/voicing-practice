import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [edges, setEdges] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const rail = ref.current!;
    const update = () => {
      const left = rail.scrollLeft > 1;
      const right = rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 1;
      setEdges((previous) =>
        previous.left === left && previous.right === right ? previous : { left, right },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    if (rail.firstElementChild) observer.observe(rail.firstElementChild);
    rail.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", update);
    };
  }, []);
  useLayoutEffect(() => {
    const rail = ref.current,
      targets = rail?.querySelectorAll<HTMLElement | SVGElement>(`[data-follow="${followKey}"]`);
    if (!rail || !targets?.length || gesture.current.id !== -1) return;
    const bounds = rail.getBoundingClientRect(),
      items = Array.from(targets, (target) => target.getBoundingClientRect()),
      start = Math.min(...items.map((item) => item.left)),
      end = Math.max(...items.map((item) => item.right));
    // 同一小节的所有音符共同决定中心；首尾受内容边界限制时停在可滚动范围内。
    const left = rail.scrollLeft + (start + end) / 2 - bounds.left - rail.clientWidth / 2;
    rail.scrollTo({
      left: Math.max(0, Math.min(left, rail.scrollWidth - rail.clientWidth)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [followKey]);
  const browse = (direction: number) => {
    const rail = ref.current!;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.65,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div
      className={`scroll-shell ${className}-shell`}
      data-left={edges.left}
      data-right={edges.right}
    >
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
      {edges.left && (
        <button
          className="rail-browse rail-browse-left"
          aria-label={`${label}：向左浏览`}
          title="左侧还有内容，点击浏览"
          onClick={() => browse(-1)}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {edges.right && (
        <button
          className="rail-browse rail-browse-right"
          aria-label={`${label}：向右浏览`}
          title="右侧还有内容，点击浏览"
          onClick={() => browse(1)}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
