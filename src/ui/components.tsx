import React from "react";
import type { Shape } from "../modes/generate/recall";

/* ---------- Icons (inline, stroke uses currentColor) ---------- */

export const Mark = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
    <path d="M39.52 11.33 A22 22 0 1 0 52.67 24.48" fill="none" stroke="currentColor" strokeWidth="9" />
    <circle cx="47.56" cy="16.44" r="5.6" fill="currentColor" />
  </svg>
);

export const PauseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </svg>
);

export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const UndoIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M9 7H5V3M5.6 7.2A8 8 0 1 1 4 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** iOS Share-sheet glyph: square tray with an arrow leaving the top. */
export const IosShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10H5.5v10.5h13V10H17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const AddSquareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const DeltaGlyph = ({ direction }: { direction: "up" | "down" | "flat" }) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    {direction === "up" && <path d="M6 1.5L11 10H1z" fill="currentColor" />}
    {direction === "down" && <path d="M6 10.5L1 2h10z" fill="currentColor" />}
    {direction === "flat" && <rect x="1" y="5" width="10" height="2.4" fill="currentColor" />}
  </svg>
);

/** Recall shapes. Distinct silhouettes, so color is never the signal. */
export const ShapeGlyph = ({ shape, filled = true }: { shape: Shape; filled?: boolean }) => {
  const paint = filled ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor", strokeWidth: 7 };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {shape === "circle" && <circle cx="50" cy="50" r="40" {...paint} />}
      {shape === "square" && <rect x="13" y="13" width="74" height="74" rx="4" {...paint} />}
      {shape === "triangle" && <path d="M50 9 L93 86 H7 Z" {...paint} strokeLinejoin="round" />}
      {shape === "diamond" && <path d="M50 4 L92 50 L50 96 L8 50 Z" {...paint} strokeLinejoin="round" />}
      {shape === "star" && (
        <path d="M50 5 L61.8 36.6 L95 37.6 L68.6 58.4 L78 91 L50 72 L22 91 L31.4 58.4 L5 37.6 L38.2 36.6 Z" {...paint} strokeLinejoin="round" />
      )}
      {shape === "cross" && <path d="M36 8 H64 V36 H92 V64 H64 V92 H36 V64 H8 V36 H36 Z" {...paint} strokeLinejoin="round" />}
    </svg>
  );
};

/* ---------- FitText: the largest size up to `max` that fits on one line ---------- */

export function FitText({ text, max, className, min = 28, maxHeight }: { text: string; max: number; className?: string; min?: number; maxHeight?: number }) {
  const box = React.useRef<HTMLDivElement>(null);
  const span = React.useRef<HTMLSpanElement>(null);
  const [size, setSize] = React.useState(max);

  React.useLayoutEffect(() => {
    const el = box.current;
    const s = span.current;
    if (!el || !s) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        s.style.fontSize = `${max}px`;
        const natural = s.scrollWidth;
        const available = el.clientWidth;
        let next = natural > available ? Math.floor((max * available) / natural) : max;
        if (maxHeight) next = Math.min(next, Math.floor(maxHeight));
        next = Math.max(min, next);
        // Leave the measured size in place: React only rewrites the style when `size` changes.
        s.style.fontSize = `${next}px`;
        setSize(next);
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [text, max, min, maxHeight]);

  return (
    <div ref={box} style={{ width: "100%", overflow: "hidden" }}>
      <span ref={span} className={className} style={{ fontSize: size, display: "inline-block" }}>
        {text}
      </span>
    </div>
  );
}

/* ---------- Bottom sheet ---------- */

export function Sheet({ title, onClose, children, labelledBy }: { title: string; onClose: () => void; children: React.ReactNode; labelledBy?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  const id = labelledBy ?? "sheet-title";
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 id={id} className="display t-40">
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/* ---------- Radio-style segmented control ---------- */

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  cols,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; activity?: string }>;
  onChange: (v: T) => void;
  cols: 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented cols-${cols}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className="segment"
          data-activity={o.activity}
          onClick={() => onChange(o.value)}
        >
          {o.activity && <span className="swatch" aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Long-press helper: fires after `ms` of continuous press. */
export function useLongPress(onLongPress: () => void, ms = 650) {
  const timer = React.useRef<number | null>(null);
  const fired = React.useRef(false);
  const clear = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  React.useEffect(() => clear, [clear]);
  return {
    fired,
    handlers: {
      onPointerDown: () => {
        fired.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, ms);
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
