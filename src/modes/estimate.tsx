import React from "react";
import type { Dot } from "./generate/estimate";
import type { ModeViewProps } from "./shared";
import { feedbackFor, Tiles, usePresentOnPaint } from "./shared";

export function EstimateView({ challenge, onAnswer, onPresented, feedback }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  const { dots, showMs, count } = challenge.data as { dots: Dot[]; showMs: number; count: number };
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), showMs);
    return () => window.clearTimeout(t);
  }, [challenge.id, showMs]);
  // After an answer, show the dots again so the count can be checked.
  const show = visible || Boolean(fb);
  return (
    <>
      <div className="stage">
        <p className="cue">{challenge.cue}</p>
        <div className="estimate-field">
          <svg viewBox="0 0 100 100" role="img" aria-label={show ? `A field of dots` : "The dots are hidden. Pick the closest number."}>
            {show && dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />)}
          </svg>
          {!show && (
            <span className="estimate-mask display" aria-hidden="true">
              ?
            </span>
          )}
          {fb && <span className="sr-only">There were {count}.</span>}
        </div>
      </div>
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} />
    </>
  );
}
