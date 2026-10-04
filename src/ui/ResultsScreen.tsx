import React from "react";
import { sfx } from "../audio/synth";
import { useStore } from "../state/store";
import { isNative, shareNative } from "../platform/native";
import { DeltaGlyph } from "./components";
import { MODE_INFO } from "../modes/registry";
import { ACTIVITY_LABEL, accuracyDeltaText, deltas, headline, minutesLabel, pct, previousMatch, rtDeltaText, secs, switchCostText } from "./copy";
import { renderShareCard } from "./shareCard";
import { SetupSheet } from "./SetupScreen";

const COUNT_MS = 900;

/** Results: a poster on the activity field, with the one orchestrated count-up. */
export function ResultsScreen() {
  const result = useStore((s) => s.lastResult);
  const history = useStore((s) => s.history);
  const prefs = useStore((s) => s.prefs);
  const startSession = useStore((s) => s.startSession);
  const go = useStore((s) => s.go);
  const target = result ? pct(result.accuracy) : 0;
  const instant = prefs.reducedMotion || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = React.useState(instant ? target : 0);
  const [sheet, setSheet] = React.useState(false);
  const [shareState, setShareState] = React.useState<"idle" | "busy" | "saved" | "failed">("idle");
  const raf = React.useRef(0);
  const skipped = React.useRef(instant);

  const prev = React.useMemo(() => (result ? previousMatch(history, result) : null), [history, result]);
  const d = React.useMemo(() => (result ? deltas(result, prev) : { accuracyPoints: null, rtSeconds: null }), [result, prev]);
  const title = result ? headline(result, prev) : "";

  React.useEffect(() => {
    sfx.complete();
    if (skipped.current) return;
    const start = performance.now();
    let lastTen = 0;
    const step = (t: number) => {
      if (skipped.current) return;
      const p = Math.min(1, (t - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(target * eased);
      if (Math.floor(v / 10) > lastTen) {
        lastTen = Math.floor(v / 10);
        sfx.count();
      }
      setShown(v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    const delay = window.setTimeout(() => (raf.current = requestAnimationFrame(step)), 250);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(raf.current);
    };
  }, [target]);

  const skip = () => {
    if (skipped.current) return;
    skipped.current = true;
    cancelAnimationFrame(raf.current);
    setShown(target);
  };

  const share = async () => {
    if (!result) return;
    setShareState("busy");
    try {
      const blob = await renderShareCard(result, title, d);
      const text = `${pct(result.accuracy)}% on CardioBrain. ${title}`;
      if (isNative && (await shareNative(blob, text))) {
        setShareState("idle");
        return;
      }
      const file = new File([blob], "cardiobrain.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        setShareState("idle");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cardiobrain.png";
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        setShareState("saved");
      }
    } catch (err) {
      setShareState((err as Error)?.name === "AbortError" ? "idle" : "failed");
    }
  };

  if (!result) {
    return (
      <main className="screen paper">
        <p className="empty">No result to show. Start a session from Home.</p>
        <button className="btn-primary" onClick={() => go("home")}>
          Home
        </button>
      </main>
    );
  }

  const cost = result.requestedMode === "switch" || result.requestedMode === "mix" ? switchCostText(result.switchCost) : null;
  const accDir = d.accuracyPoints === null ? null : d.accuracyPoints > 0 ? "up" : d.accuracyPoints < 0 ? "down" : "flat";
  const rtDir = d.rtSeconds === null ? null : d.rtSeconds < 0 ? "up" : d.rtSeconds > 0 ? "down" : "flat";

  return (
    <main className="screen field results" data-activity={result.activity} onPointerDown={skip}>
      <p className="results-kicker">
        {ACTIVITY_LABEL[result.activity]}, {result.guided ? "first round" : MODE_INFO[result.requestedMode].label}
      </p>
      <h1 className="display results-headline">{title}</h1>
      <div className="results-score" aria-hidden="true">
        <span className="display num">{shown}</span>
        <span className="pct">%</span>
      </div>
      <p className="t-17" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {accDir && <DeltaGlyph direction={accDir} />}
        {d.accuracyPoints === null ? "Accuracy" : `Accuracy. ${accuracyDeltaText(d.accuracyPoints)}.`}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {title} {pct(result.accuracy)} percent accuracy. {accuracyDeltaText(d.accuracyPoints)}.
      </p>

      <div className="stats grow">
        <div className="stat">
          <span className="stat-label">Duration</span>
          <span className="stat-value num">{minutesLabel(result.durationSeconds)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Challenges</span>
          <span className="stat-value num">{result.challenges}</span>
          <span className="stat-delta">Best streak {result.bestStreak}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Average response</span>
          <span className="stat-value num">{secs(result.avgRt)}</span>
          {d.rtSeconds !== null && (
            <span className="stat-delta">
              {rtDir && <DeltaGlyph direction={rtDir} />}
              {rtDeltaText(d.rtSeconds)}
            </span>
          )}
        </div>
        {cost && (
          <div className="stat">
            <span className="stat-label">Switch cost</span>
            <span className="stat-delta" style={{ gridColumn: "1 / -1" }}>
              {cost}
            </span>
          </div>
        )}
      </div>

      <div className="stack gap-8" style={{ marginTop: 16 }}>
        <button
          className="btn-primary"
          onClick={() => {
            if (result.guided) go("home");
            else void startSession();
          }}
        >
          {result.guided ? "Continue" : "Go again"}
        </button>
        <div className="btn-row spread">
          <button className="btn-text" onClick={() => setSheet(true)}>
            Change
          </button>
          <button className="btn-text" onClick={() => void share()} disabled={shareState === "busy"}>
            {shareState === "saved" ? "Saved image" : shareState === "failed" ? "Share failed, try again" : "Share"}
          </button>
          <button className="btn-text" onClick={() => go("home")}>
            Home
          </button>
        </div>
      </div>
      {sheet && <SetupSheet onClose={() => setSheet(false)} />}
    </main>
  );
}
