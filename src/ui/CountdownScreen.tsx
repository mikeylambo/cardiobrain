import React from "react";
import { sfx } from "../audio/synth";
import { haptics } from "../haptics";

/**
 * 3-2-1 on the activity field. Calls onFinished once, after "1" has had its second.
 * A resume can be skipped with a tap: you were already mid-session and know what's coming.
 */
export function Countdown({ onFinished, label, skippable = false }: { onFinished: () => void; label: string; skippable?: boolean }) {
  const [n, setN] = React.useState(3);
  const finished = React.useRef(onFinished);
  finished.current = onFinished;
  const done = React.useRef(false);
  const timers = React.useRef<number[]>([]);

  const finish = React.useCallback(() => {
    if (done.current) return;
    done.current = true;
    timers.current.forEach((t) => window.clearTimeout(t));
    sfx.go();
    haptics.go();
    finished.current();
  }, []);

  React.useEffect(() => {
    sfx.tick();
    haptics.tick();
    timers.current = [
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
      window.setTimeout(finish, 3000),
    ];
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, [finish]);

  return (
    <div
      className="overlay countdown field"
      role="timer"
      aria-live="assertive"
      aria-label={`${label}. Starting in ${n}`}
      onPointerDown={skippable ? finish : undefined}
    >
      <p className="cue">{label}</p>
      <span key={n} className="num-big tick num" aria-hidden="true">
        {n}
      </span>
      {skippable && (
        <button className="btn-text countdown-skip" onClick={finish}>
          Tap to go now
        </button>
      )}
    </div>
  );
}
