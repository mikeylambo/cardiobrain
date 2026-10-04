import React from "react";
import type { AnswerOption, Challenge } from "../engine/types";
import { FitText } from "../ui/components";

export interface Feedback {
  challengeId: string;
  pickedId: string;
  correct: boolean;
  correctId: string;
}

export interface ModeViewProps {
  challenge: Challenge;
  onAnswer: (answerId: string) => void;
  onPresented: () => void;
  feedback: Feedback | null;
  /** True for the first challenge after the start countdown: plays the width resolve. */
  entering: boolean;
}

/** Feedback for this challenge only; a stale one from the previous trial is ignored. */
export const feedbackFor = (fb: Feedback | null, c: Challenge) => (fb && fb.challengeId === c.id ? fb : null);

/** Mark the challenge answerable once its first frame has painted. */
export function usePresentOnPaint(onPresented: () => void, key: string, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => onPresented());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [onPresented, key, enabled]);
}

export function Stage({
  cue,
  prompt,
  feedback,
  entering,
  max = 160,
  children,
}: {
  cue?: string;
  prompt?: string;
  feedback: Feedback | null;
  entering: boolean;
  max?: number;
  children?: React.ReactNode;
}) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(400);
  React.useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const cls = ["stimulus", "display", entering ? "enter" : "", feedback?.correct ? "breath" : ""].filter(Boolean).join(" ");
  return (
    <div className="stage" ref={stageRef}>
      {cue && <p className="cue">{cue}</p>}
      {prompt !== undefined && <FitText text={prompt} max={max} className={cls} maxHeight={height * 0.62} />}
      {children}
    </div>
  );
}

export function Tiles({
  options,
  onPick,
  feedback,
  disabled = false,
  cols = 2,
  render,
  variant = "number",
  pressedId,
}: {
  options: AnswerOption[];
  onPick: (id: string) => void;
  feedback: Feedback | null;
  disabled?: boolean;
  cols?: 2 | 3;
  render?: (o: AnswerOption) => React.ReactNode;
  variant?: "number" | "word" | "label" | "blank";
  /** Momentary press highlight driven by the parent (Recall builds a sequence before answering). */
  pressedId?: string | null;
}) {
  const oneRow = options.length === 2;
  // Keyboard: 1-6 pick tiles in reading order; with two answers, Left and Right do too.
  const pickRef = React.useRef(onPick);
  pickRef.current = onPick;
  React.useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
      let i = -1;
      if (/^[1-9]$/.test(e.key)) i = Number(e.key) - 1;
      else if (options.length === 2 && e.key === "ArrowLeft") i = 0;
      else if (options.length === 2 && e.key === "ArrowRight") i = 1;
      const o = options[i];
      if (!o) return;
      e.preventDefault();
      pickRef.current(o.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, options]);
  return (
    <div className={`tiles${oneRow ? " one-row" : ""}${cols === 3 ? " cols-3" : ""}`} role="group" aria-label="Answers">
      {options.map((o) => {
        const picked = feedback?.pickedId === o.id || pressedId === o.id;
        const wrongPick = feedback && !feedback.correct && feedback.pickedId === o.id;
        const reveal = feedback && !feedback.correct && feedback.correctId === o.id;
        const burst = feedback?.correct && feedback.pickedId === o.id;
        const cls = [
          "tile",
          variant === "word" || variant === "label" ? "word" : "",
          picked ? "pressed" : "",
          wrongPick ? "nudge" : "",
          reveal ? "reveal" : "",
          burst ? "correct-burst" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={o.id}
            className={cls}
            aria-label={o.label}
            disabled={disabled}
            data-answer={o.id}
            onPointerDown={(e) => {
              if (e.button !== 0 || disabled) return;
              onPick(o.id);
            }}
            onClick={(e) => {
              // Keyboard and assistive tech activate with click and no pointer.
              if (e.detail === 0 && !disabled) onPick(o.id);
            }}
          >
            {render ? render(o) : variant === "blank" ? null : o.label}
          </button>
        );
      })}
    </div>
  );
}
