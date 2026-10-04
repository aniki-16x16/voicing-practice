import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// 有内容的小节长按 1.2 秒确认；松开后进度在 180ms 内回落（样式中统一调整）。
const holdDuration = 1200;

export function DeleteBarButton({ empty, onDelete }: { empty: boolean; onDelete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const hold = useRef<{
    frame?: number;
    started?: number;
    pointer?: number;
    key?: string;
    suppressClick: boolean;
  }>({ suppressClick: false });
  const cancel = () => {
    cancelAnimationFrame(hold.current.frame ?? 0);
    hold.current.frame = undefined;
    hold.current.started = undefined;
    hold.current.pointer = undefined;
    hold.current.key = undefined;
    setHolding(false);
    setProgress(0);
  };
  const begin = () => {
    if (hold.current.started !== undefined) return;
    hold.current.suppressClick = true;
    hold.current.started = performance.now();
    setHolding(true);
    setProgress(0);
    const advance = (now: number) => {
      if (hold.current.started === undefined) return;
      const next = Math.min(1, (now - hold.current.started) / holdDuration);
      setProgress(next);
      if (next === 1) {
        hold.current.frame = undefined;
        onDelete();
      } else hold.current.frame = requestAnimationFrame(advance);
    };
    hold.current.frame = requestAnimationFrame(advance);
  };
  useEffect(() => {
    const blur = () => cancel();
    const visibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    const state = hold.current;
    return () => {
      cancelAnimationFrame(state.frame ?? 0);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <button
      type="button"
      className={`delete-bar ${empty ? "empty" : ""}`}
      aria-label="删除当前小节"
      title={empty ? "点击删除当前空小节" : "长按 1.2 秒删除当前小节，松开取消"}
      data-holding={holding}
      onPointerDown={(e) => {
        if (empty || e.button !== 0 || hold.current.started !== undefined) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold.current.pointer = e.pointerId;
        begin();
      }}
      onPointerMove={(e) => {
        if (hold.current.pointer !== e.pointerId) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          cancel();
      }}
      onPointerUp={(e) => {
        if (hold.current.pointer === e.pointerId) cancel();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (![" ", "Enter"].includes(e.key)) return;
        if (hold.current.started !== undefined) {
          e.preventDefault();
          return;
        }
        if (empty) return;
        e.preventDefault();
        if (!e.repeat && hold.current.started === undefined) {
          hold.current.key = e.key;
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (hold.current.key === e.key) {
          e.preventDefault();
          cancel();
          // 键盘确认已拦截原生 click，无需影响下一次鼠标点击。
          hold.current.suppressClick = false;
        }
      }}
      onClick={() => {
        if (hold.current.suppressClick) {
          hold.current.suppressClick = false;
          return;
        }
        if (empty) onDelete();
      }}
    >
      <span
        className="delete-bar-fill"
        aria-hidden="true"
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="delete-bar-label">
        <Trash2 size={15} />
        {empty ? "删除小节" : "长按删除"}
      </span>
    </button>
  );
}
