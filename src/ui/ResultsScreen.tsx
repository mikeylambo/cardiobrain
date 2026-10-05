import React from "react";
import { sfx } from "../audio/synth";
import { say } from "../audio/speech";
import { useStore } from "../state/store";
import { isNative, shareNative, shareText } from "../platform/native";
import { challengeLink } from "../platform/links";
import { dailyNumber } from "../engine/daily";
import { modeBreakdown, motionCost, motionCostText, personalBests } from "../engine/insights";
import { MODE_INFO } from "../modes/registry";
import { DeltaGlyph, Sheet } from "./components";
import {
  ACTIVITY_LABEL,
  accuracyDeltaText,
  presetLine,
  rivalText,
  spokenSummary,
  deltas,
  headline,
  minutesLabel,
  pct,
  previousMatch,
  rtDeltaText,
  secs,
  switchCostText,
} from "./copy";
import type { CardFormat } from "./shareCard";
import { SetupSheet } from "./SetupScreen";

const COUNT_MS = 900;
const RPE_ANCHORS: Record<number, string> = { 1: "Very easy", 3: "Moderate", 5: "Hard", 7: "Very hard", 10: "Max" };
export const MOODS = ["Low", "Flat", "Okay", "Good", "Great"];

/** Results: a poster on the activity field, with the one orchestrated count-up. */
export function ResultsScreen() {
  const result = useStore((s) => s.lastResult);
  const history = useStore((s) => s.history);
  const prefs = useStore((s) => s.prefs);
  const requestStart = useStore((s) => s.requestStart);
  const updateResult = useStore((s) => s.updateResult);
  const go = useStore((s) => s.go);
  const flags = useStore((s) => s.flags);
  const markMotionNudged = useStore((s) => s.markMotionNudged);
  const target = result ? pct(result.accuracy) : 0;
  const instant = prefs.reducedMotion || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = React.useState(instant ? target : 0);
  const [sheet, setSheet] = React.useState(false);
  const [shareSheet, setShareSheet] = React.useState(false);
  const [shareState, setShareState] = React.useState<"idle" | "busy" | "saved" | "failed">("idle");
  const raf = React.useRef(0);
  const skipped = React.useRef(instant);

  const prev = React.useMemo(() => (result && !result.daily ? previousMatch(history, result) : null), [history, result]);
  const d = React.useMemo(() => (result ? deltas(result, prev) : { accuracyPoints: null, rtSeconds: null }), [result, prev]);
  const bests = React.useMemo(() => (result ? personalBests(history, result) : null), [history, result]);
  const cost = React.useMemo(
    () => (result && result.activity !== "still" && !result.daily && !result.guided ? motionCost(history, result.requestedMode, [result]) : null),
    [history, result],
  );
  const title = result ? (result.daily ? `Daily #${dailyNumber(result.daily)} done.` : result.practice ? "Practice done." : headline(result, prev)) : "";
  const breakdown = React.useMemo(() => (result && (result.requestedMode === "mix" || result.daily) ? modeBreakdown(result) : []), [result]);
  const kicker = result
    ? result.daily
      ? `Daily challenge, ${ACTIVITY_LABEL[result.activity].toLowerCase()}`
      : `${ACTIVITY_LABEL[result.activity]}, ${result.guided ? "first round" : result.practice ? `${MODE_INFO[result.requestedMode].label} practice` : MODE_INFO[result.requestedMode].label}`
    : "";

  // The "play it seated" reminder shows once per mode, then stays out of the way.
  const [nudge] = React.useState(() => Boolean(result && !flags.motionNudged.includes(result.requestedMode)));
  React.useEffect(() => {
    if (result && nudge && !cost && result.activity !== "still" && !result.daily && !result.guided) markMotionNudged(result.requestedMode);
  }, [result, nudge, cost, markMotionNudged]);

  // Eyes-free runs end with the result read aloud.
  React.useEffect(() => {
    if (!result || !prefs.speak) return;
    const best = bests ? [bests.accuracy && "accuracy", bests.speed && "speed", bests.streak && "streak"].filter((x): x is string => Boolean(x)) : [];
    const text = spokenSummary(result, title, {
      accuracyPoints: d.accuracyPoints,
      bests: best,
      rival: result.rival !== undefined ? rivalText(result.accuracy, result.rival) : undefined,
    });
    const t = window.setTimeout(() => say(text), 900);
    return () => window.clearTimeout(t);
    // Read once, when Results opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);

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

  const [linkNote, setLinkNote] = React.useState<string | null>(null);
  // A link that opens this exact daily for a friend, with your score to beat.
  const sendChallenge = async () => {
    if (!result?.daily) return;
    const link = challengeLink(result.daily, result.accuracy);
    const text = `I got ${pct(result.accuracy)}% on CardioBrain Daily #${dailyNumber(result.daily)}. Can you beat it?`;
    if (await shareText("CardioBrain challenge", `${text} ${link}`)) return;
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setLinkNote("Link copied. Paste it to a friend.");
    } catch {
      setLinkNote(link);
    }
  };

  const share = async (format: CardFormat) => {
    if (!result) return;
    setShareSheet(false);
    setShareState("busy");
    try {
      const { renderShareCard } = await import("./shareCard");
      const blob = await renderShareCard(result, title, d, format, kicker);
      const text = result.daily
        ? `CardioBrain Daily #${dailyNumber(result.daily)}: ${pct(result.accuracy)}%. Can you beat it? ${challengeLink(result.daily, result.accuracy)}`
        : `${pct(result.accuracy)}% on CardioBrain. ${title}`;
      if (isNative && (await shareNative(blob, text))) {
        setShareState("idle");
        return;
      }
      const file = new File([blob], `cardiobrain-${format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        setShareState("idle");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cardiobrain-${format}.png`;
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

  const switchCost = result.requestedMode === "switch" || result.requestedMode === "mix" ? switchCostText(result.switchCost) : null;
  const accDir = d.accuracyPoints === null ? null : d.accuracyPoints > 0 ? "up" : d.accuracyPoints < 0 ? "down" : "flat";
  const rtDir = d.rtSeconds === null ? null : d.rtSeconds < 0 ? "up" : d.rtSeconds > 0 ? "down" : "flat";
  const bestList = bests ? [bests.accuracy && "accuracy", bests.speed && "speed", bests.streak && "streak"].filter(Boolean) : [];
  const askEffort = !result.guided && !result.practice && result.activity !== "still";
  const askMood = prefs.moodCheckIn && !result.guided;

  return (
    <main className="screen field results" data-activity={result.activity} onPointerDown={skip}>
      <p className="results-kicker">{kicker}</p>
      <h1 className="display results-headline">{title}</h1>
      <div className="results-score" aria-hidden="true">
        <span className="display num">{shown}</span>
        <span className="pct">%</span>
      </div>
      <p className="t-17" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {accDir && <DeltaGlyph direction={accDir} />}
        {d.accuracyPoints === null ? "Accuracy" : `Accuracy. ${accuracyDeltaText(d.accuracyPoints)}.`}
      </p>
      {bestList.length > 0 && <p className="best-line">New personal best: {bestList.join(", ")}.</p>}
      {result.rival !== undefined && <p className="best-line rival-line">{rivalText(result.accuracy, result.rival)}</p>}
      <p className="sr-only" role="status" aria-live="polite">
        {title} {pct(result.accuracy)} percent accuracy. {d.accuracyPoints === null ? "" : `${accuracyDeltaText(d.accuracyPoints)}.`}
        {bestList.length ? ` New personal best: ${bestList.join(", ")}.` : ""}
      </p>

      {result.guided ? (
        <GuidedNext />
      ) : (
        <>
          <div className="stats">
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
              <span className="stat-label">
                Response time <span className="stat-sub">correct answers</span>
              </span>
              <span className="stat-value num">{secs(result.avgRt)}</span>
              {d.rtSeconds !== null && (
                <span className="stat-delta">
                  {rtDir && <DeltaGlyph direction={rtDir} />}
                  {rtDeltaText(d.rtSeconds)}
                </span>
              )}
            </div>
            {switchCost && (
              <div className="stat">
                <span className="stat-label">Switch cost</span>
                <span className="stat-delta" style={{ gridColumn: "1 / -1" }}>
                  {switchCost}
                </span>
              </div>
            )}
            {breakdown.length >= 2 && (
              <div className="stat breakdown">
                <span className="stat-label">By mode</span>
                <ul className="breakdown-list" style={{ gridColumn: "1 / -1" }}>
                  {breakdown.map((b) => (
                    <li key={b.mode}>
                      <span>{MODE_INFO[b.mode].label}</span>
                      <span className="breakdown-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(b.accuracy * 100)}%` }} />
                      </span>
                      <span className="num">{Math.round(b.accuracy * 100)}%</span>
                      <span className="num">{secs(b.avgRt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!result.daily && !result.guided && !result.practice && (result.activity === "still" || cost || nudge) && (
              <div className="stat">
                <span className="stat-label">Motion cost</span>
                <span className="stat-delta" style={{ gridColumn: "1 / -1" }}>
                  {result.activity === "still"
                    ? `Seated baseline saved for ${MODE_INFO[result.requestedMode].label}. Moving sessions will compare against it.`
                    : cost
                      ? motionCostText(cost)
                      : `Play ${MODE_INFO[result.requestedMode].label} once seated to see what moving costs you.`}
                </span>
              </div>
            )}
          </div>

          {(askEffort || askMood) && (
            <div className="checkin" role="group" aria-label="Check-in">
              {askEffort && (
                <>
                  <p id="rpe-label" className="checkin-label">
                    Effort <span className="checkin-hint">1 very easy, 10 max</span>
                  </p>
                  <div className="rpe">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        className="rpe-btn num"
                        aria-pressed={result.rpe === n}
                        aria-label={`${n}${RPE_ANCHORS[n] ? `, ${RPE_ANCHORS[n]}` : ""}`}
                        onClick={() => updateResult(result.id, { rpe: n })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {askMood && (
                <>
                  <p id="mood-after-label" className="checkin-label" style={{ marginTop: askEffort ? 12 : 0 }}>
                    Mood now
                  </p>
                  <div className="mood">
                    {MOODS.map((m, i) => (
                      <button
                        key={m}
                        className="rpe-btn"
                        aria-pressed={result.moodAfter === i + 1}
                        onClick={() => updateResult(result.id, { moodAfter: i + 1 })}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
      <div className="grow" />
      <div className="stack gap-8" style={{ marginTop: 20 }}>
        {result.guided && (
          <button className="btn-primary" onClick={() => requestStart()}>
            Start a full session
          </button>
        )}
        <button
          className={result.guided ? "btn-text guided-home" : "btn-primary"}
          onClick={() => {
            if (result.guided || result.daily) go("home");
            else if (result.practice) go("insights");
            else requestStart();
          }}
        >
          {result.guided ? "Go to Home" : result.daily ? "Continue" : result.practice ? "Back to Insights" : "Go again"}
        </button>
        {!result.guided && (
          <div className="btn-row spread">
            <button className="btn-text" onClick={() => setSheet(true)}>
              Change
            </button>
            <button className="btn-text" onClick={() => setShareSheet(true)} disabled={shareState === "busy"}>
              Share
            </button>
            <button className="btn-text" onClick={() => go("home")}>
              Home
            </button>
          </div>
        )}
      </div>
      {shareState !== "idle" && shareState !== "busy" && (
        <p className="t-14" role="status" style={{ marginTop: 6 }}>
          {shareState === "saved" ? "Image saved to your downloads." : "Couldn't make the image. Try again."}
        </p>
      )}
      {sheet && <SetupSheet onClose={() => setSheet(false)} />}
      {shareSheet && (
        <Sheet title="Share" onClose={() => setShareSheet(false)}>
          <div className="stack gap-8">
            <button className="btn-primary" onClick={() => void share("poster")}>
              Poster
            </button>
            <button className="btn-primary" onClick={() => void share("story")}>
              Story
            </button>
            <p className="sheet-note">Poster fits feeds and messages. Story is tall, for Instagram and WhatsApp stories.</p>
            {result.daily && (
              <>
                <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => void sendChallenge()}>
                  Send a challenge link
                </button>
                {linkNote && (
                  <p className="t-14" role="status">
                    {linkNote}
                  </p>
                )}
              </>
            )}
          </div>
        </Sheet>
      )}
    </main>
  );
}

/** After the first round: what the app does next, and the three ways in. */
function GuidedNext() {
  const setup = useStore((s) => s.setup);
  return (
    <div className="guided-next">
      <p className="t-17">Your levels adapt as you play. Every mode starts gentle and finds your pace within a dozen answers.</p>
      <ul>
        <li>
          <strong>Start</strong> plays your preset: {presetLine(setup.activity, setup.mode, setup.duration)}. Change it any time on Home.
        </li>
        <li>
          <strong>The Daily</strong> is 3 minutes, the same for everyone. Share it and challenge a friend.
        </li>
        <li>
          <strong>Play once seated</strong> and Results will show what moving costs your thinking.
        </li>
      </ul>
    </div>
  );
}
