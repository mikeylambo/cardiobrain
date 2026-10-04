import React from "react";
import { ZONES, type Zone } from "./generate/react";
import type { ModeViewProps } from "./shared";
import { feedbackFor, Tiles } from "./shared";
import { ShapeGlyph } from "../ui/components";

export function ReactView({ challenge, onAnswer, onPresented, feedback }: ModeViewProps) {
  const { zone, noGo, decoy, delayMs } = challenge.data as { zone: Zone; noGo: boolean; decoy: Zone | null; delayMs: number };
  const [shown, setShown] = React.useState(false);
  const fb = feedbackFor(feedback, challenge);

  React.useEffect(() => {
    setShown(false);
    let raf = 0;
    const t = window.setTimeout(() => {
      setShown(true);
      // Onset is the frame the target actually paints, not the timer that scheduled it.
      raf = requestAnimationFrame(() => requestAnimationFrame(() => onPresented()));
    }, delayMs);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [challenge.id, delayMs, onPresented]);

  return (
    <>
      <div className="stage">
        <p className="cue">{shown && noGo ? "Hold. Don't tap." : "Tap where it lands"}</p>
        <div className="react-field" aria-hidden="true">
          {ZONES.map((z) => (
            <div className="react-cell" key={z}>
              {shown && z === zone && <span className="pop">{noGo ? <ShapeGlyph shape="square" /> : <ShapeGlyph shape="circle" />}</span>}
              {shown && z === decoy && (
                <span className="pop">
                  <ShapeGlyph shape="circle" filled={false} />
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="sr-only" aria-live="assertive">
          {shown
            ? noGo
              ? "Square. Hold."
              : `Circle, ${zone === "tl" ? "top left" : zone === "tr" ? "top right" : zone === "bl" ? "bottom left" : "bottom right"}.`
            : ""}
        </p>
      </div>
      <Tiles
        options={challenge.options}
        onPick={onAnswer}
        feedback={fb}
        disabled={Boolean(fb)}
        render={(o) => (
          // Each tile carries a tiny map of its own place, so the pad never looks empty.
          <span className="minimap" aria-hidden="true">
            {ZONES.map((z) => (
              <i key={z} className={z === o.id ? "on" : undefined} />
            ))}
          </span>
        )}
      />
    </>
  );
}
