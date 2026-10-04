import React from "react";
import { sfx } from "../audio/synth";
import { say } from "../audio/speech";
import { useStore } from "../state/store";
import { haptics } from "../haptics";
import { SHAPE_LABEL, type Shape } from "./generate/recall";
import type { ModeViewProps } from "./shared";
import { feedbackFor, Tiles } from "./shared";
import { ShapeGlyph, UndoIcon } from "../ui/components";

const GAP_MS = 180;

export function RecallView({ challenge, onAnswer, onPresented, feedback }: ModeViewProps) {
  const { sequence, stepMs } = challenge.data as { sequence: Shape[]; stepMs: number };
  const [step, setStep] = React.useState(-1); // index being shown; -1 before the first
  const [visible, setVisible] = React.useState(false);
  const [input, setInput] = React.useState<Shape[]>([]);
  const [pressed, setPressed] = React.useState<string | null>(null);
  const fb = feedbackFor(feedback, challenge);
  const showing = step < sequence.length;

  // Play the sequence: one symbol at a time, a tone each, then hand over.
  React.useEffect(() => {
    setStep(-1);
    setInput([]);
    const timers: number[] = [];
    let at = 450;
    sequence.forEach((shape, i) => {
      timers.push(
        window.setTimeout(() => {
          setStep(i);
          setVisible(true);
          sfx.symbol(shape);
          if (useStore.getState().prefs.speak) say(SHAPE_LABEL[shape]);
        }, at),
      );
      timers.push(window.setTimeout(() => setVisible(false), at + stepMs - GAP_MS));
      at += stepMs;
    });
    timers.push(
      window.setTimeout(() => {
        setStep(sequence.length);
        requestAnimationFrame(() => requestAnimationFrame(() => onPresented()));
      }, at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [challenge.id, sequence, stepMs, onPresented]);

  React.useEffect(() => {
    if (!pressed) return;
    const t = window.setTimeout(() => setPressed(null), 120);
    return () => window.clearTimeout(t);
  }, [pressed, input.length]);

  const pick = (id: string) => {
    if (showing || fb || input.length >= sequence.length) return;
    const next = [...input, id as Shape];
    setInput(next);
    setPressed(id);
    sfx.symbol(id);
    haptics.tap();
    if (next.length === sequence.length) onAnswer(next.join(" "));
  };

  const cols = challenge.options.length > 4 ? 3 : 2;
  return (
    <>
      <div className="stage">
        <p className="cue">{showing ? "Watch" : fb ? (fb.correct ? "Exactly right" : "Not quite") : "Now repeat it"}</p>
        {showing ? (
          <>
            <div className="recall-show" aria-hidden="true">
              {step >= 0 && visible && (
                <span className="pop" key={step}>
                  <ShapeGlyph shape={sequence[step]!} />
                </span>
              )}
            </div>
            <div className="recall-dots" aria-label={`${Math.max(0, step + 1)} of ${sequence.length}`}>
              {sequence.map((_, i) => (
                <i key={i} className={i <= step ? "on" : undefined} />
              ))}
            </div>
            <p className="sr-only" aria-live="assertive">
              {step >= 0 ? SHAPE_LABEL[sequence[step]!] : ""}
            </p>
          </>
        ) : (
          <div className="recall-show" aria-hidden="true" />
        )}
      </div>
      <div className="tray" aria-label={`Your sequence, ${input.length} of ${sequence.length}`}>
        <div className="tray-slots">
          {sequence.map((_, i) => (
            <span key={i} className={`tray-slot${input[i] ? " filled" : ""}`}>
              {input[i] && <ShapeGlyph shape={input[i]!} />}
            </span>
          ))}
        </div>
        <button className="undo" onClick={() => setInput((s) => s.slice(0, -1))} disabled={showing || !input.length || Boolean(fb)} aria-label="Undo last">
          <UndoIcon />
          Undo
        </button>
      </div>
      <Tiles
        options={challenge.options}
        onPick={pick}
        feedback={null}
        pressedId={pressed}
        disabled={showing || Boolean(fb)}
        cols={cols}
        render={(o) => <ShapeGlyph shape={o.id as Shape} />}
      />
    </>
  );
}
