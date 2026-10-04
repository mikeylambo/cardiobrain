import React from "react";
import { sfx } from "../audio/synth";
import { haptics } from "../haptics";

/** 3-2-1 on the activity field. Calls onFinished once, after "1" has had its second. */
export function Countdown({ onFinished, label }: { onFinished: () => void; label: string }) {
  const [n, setN] = React.useState(3);
  const finished = React.useRef(onFinished);
  finished.current = onFinished;

  React.useEffect(() => {
    sfx.tick();
    haptics.tick();
    const timers = [
      window.setTimeout(() => {
        setN(2);
        sfx.tick();
        haptics.tick();
      }, 1000),
      window.setTimeout(() => {
        setN(1);
        sfx.tick();
        haptics.tick();
      }, 2000),
      window.setTimeout(() => {
        sfx.go();
        haptics.go();
        finished.current();
      }, 3000),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="overlay countdown field" role="timer" aria-live="assertive" aria-label={`${label}. Starting in ${n}`}>
      <p className="cue">{label}</p>
      <span key={n} className="num-big tick num" aria-hidden="true">
        {n}
      </span>
    </div>
  );
}
