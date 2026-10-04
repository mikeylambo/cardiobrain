import React from "react";
import type { ModeChoice, SessionResult } from "../engine/types";
import { MODE_CHOICES, MODE_INFO, PLAYABLE_MODES } from "../modes/registry";
import { MAX_LEVEL } from "../engine/difficulty";
import { dailyNumber } from "../engine/daily";
import { useStore } from "../state/store";
import { BackIcon, Sheet } from "./components";
import { ACTIVITY_LABEL, minutesLabel, pct, secs, sessionNote, switchCostText } from "./copy";

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** One series, one axis: a 2px line, recessive baseline, the latest value labelled, tap a point to read it. */
function Trend({
  title,
  values,
  format,
  invert = false,
}: {
  title: string;
  values: Array<{ v: number; t: number }>;
  format: (v: number) => string;
  invert?: boolean;
}) {
  const [focus, setFocus] = React.useState<number | null>(null);
  const W = 320;
  const H = 88;
  const pad = 6;
  if (values.length < 2) {
    return (
      <div className="trend">
        <div className="trend-head">
          <span className="t-17">{title}</span>
          <strong className="num">{values[0] ? format(values[0].v) : "–"}</strong>
        </div>
        <p className="t-14" style={{ color: "var(--muted)", marginTop: 6 }}>
          A trend appears after two sessions.
        </p>
      </div>
    );
  }
  const vs = values.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (values.length - 1);
  // Higher is better for accuracy; for response time lower is better, so the axis flips and "up" always means "better".
  const y = (v: number) => {
    const n = (v - lo) / span;
    return pad + (invert ? n : 1 - n) * (H - pad * 2);
  };
  const d = values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const shown = focus ?? values.length - 1;
  const point = values[shown]!;
  return (
    <div className="trend">
      <div className="trend-head">
        <span className="t-17">{title}</span>
        <strong className="num">{format(point.v)}</strong>
      </div>
      <p className="t-14" style={{ color: "var(--muted)" }}>
        {focus === null ? "Latest" : new Date(point.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        {invert ? ". Higher on the chart is faster." : ""}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} over the last ${values.length} sessions, from ${format(values[0]!.v)} to ${format(values[values.length - 1]!.v)}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (values.length - 1));
          setFocus(Math.max(0, Math.min(values.length - 1, i)));
        }}
        onPointerLeave={() => setFocus(null)}
      >
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} stroke="var(--rule)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="var(--asphalt)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(shown)} cy={y(point.v)} r={5} fill="var(--asphalt)" stroke="var(--chalk)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function ConsistencyStrip({ history }: { history: SessionResult[] }) {
  const today = startOfDay(Date.now());
  // Five full weeks ending with this week, Monday first.
  const dow = (new Date(today).getDay() + 6) % 7;
  const first = today - (dow + 28) * DAY;
  const days = new Set(history.map((h) => startOfDay(h.startedAt)));
  const cells = Array.from({ length: 35 }, (_, i) => first + i * DAY);
  const active = cells.filter((c) => days.has(c)).length;
  return (
    <div style={{ marginTop: 24 }}>
      <div className="trend-head">
        <span className="t-17">Last five weeks</span>
        <strong className="num">
          {active} {active === 1 ? "day" : "days"}
        </strong>
      </div>
      <div className="strip" role="img" aria-label={`Trained on ${active} of the last 35 days`}>
        {cells.map((c) => (
          <span key={c} className={`strip-day${days.has(c) ? " on" : ""}${c === today ? " today" : ""}`} style={c > today ? { opacity: 0.35 } : undefined} />
        ))}
      </div>
    </div>
  );
}

function Detail({ r, onClose, onDeleted }: { r: SessionResult; onClose: () => void; onDeleted: (r: SessionResult) => void }) {
  const cost = switchCostText(r.switchCost);
  const deleteSession = useStore((s) => s.deleteSession);
  const rows: Array<[string, string]> = [
    ["Accuracy", `${pct(r.accuracy)}%`],
    ["Duration", minutesLabel(r.durationSeconds)],
    ["Challenges", String(r.challenges)],
    ["Response time (correct)", secs(r.avgRt)],
    ["Best streak", String(r.bestStreak)],
  ];
  return (
    <Sheet title={`${ACTIVITY_LABEL[r.activity]}, ${MODE_INFO[r.requestedMode].label}`} onClose={onClose}>
      <p className="t-14" style={{ color: "var(--muted)" }}>
        {new Date(r.startedAt).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      <div className="stats" style={{ marginTop: 12 }}>
        {rows.map(([k, v]) => (
          <div className="stat" key={k} style={{ borderTopWidth: 1, borderColor: "var(--rule)" }}>
            <span className="stat-label">{k}</span>
            <span className="stat-value num">{v}</span>
          </div>
        ))}
        {cost && (
          <div className="stat" style={{ borderTopWidth: 1, borderColor: "var(--rule)" }}>
            <span className="stat-label">Switch cost</span>
            <span className="stat-delta">{cost}</span>
          </div>
        )}
      </div>
      <p className="t-17" style={{ marginTop: 16 }}>
        {sessionNote(r)}
      </p>
      <div className="detail-actions">
        <button
          className="btn-text"
          onClick={() => {
            deleteSession(r.id);
            onDeleted(r);
            onClose();
          }}
        >
          Delete this session
        </button>
      </div>
    </Sheet>
  );
}

/** Where the difficulty controller has each mode, 1 to 20. */
function Levels() {
  const progress = useStore((s) => s.progress);
  const resetLevel = useStore((s) => s.resetLevel);
  const [resetting, setResetting] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const played = PLAYABLE_MODES.filter((m) => progress[m]?.level);
  return (
    <div style={{ marginTop: 28 }}>
      <div className="trend-head">
        <span className="t-17">Levels</span>
        <span className="t-14" style={{ color: "var(--muted)" }}>
          of {MAX_LEVEL}
        </span>
      </div>
      <ul className="levels">
        {PLAYABLE_MODES.map((m) => {
          const level = progress[m]?.level ?? 0;
          return (
            <li key={m}>
              <span className="t-14">{MODE_INFO[m].label}</span>
              <span
                className="level-bar"
                role="img"
                aria-label={level ? `${MODE_INFO[m].label}, level ${level} of ${MAX_LEVEL}` : `${MODE_INFO[m].label}, not played yet`}
              >
                <span style={{ width: `${(level / MAX_LEVEL) * 100}%` }} />
              </span>
              <span className="num t-14 level-num">{level || "–"}</span>
            </li>
          );
        })}
      </ul>
      {played.length > 0 && (
        <button className="btn-text" style={{ marginTop: 4 }} onClick={() => setResetting(true)}>
          Reset a level
        </button>
      )}
      {resetting && (
        <Sheet
          title="Reset a level"
          onClose={() => {
            setResetting(false);
            setDone(null);
          }}
        >
          <p className="t-17" style={{ marginBottom: 12 }}>
            If a mode feels far too easy or too hard, reset it. Its next session finds your level again over the first dozen challenges. Your history stays.
          </p>
          <ul className="reset-list">
            {played.map((m) => (
              <li key={m}>
                <span className="t-17">
                  {MODE_INFO[m].label} <span className="t-14 num">level {progress[m]!.level}</span>
                </span>
                <button
                  className="btn-text"
                  aria-label={`Reset ${MODE_INFO[m].label}`}
                  onClick={() => {
                    resetLevel(m);
                    setDone(`${MODE_INFO[m].label} will find your level again next time.`);
                  }}
                >
                  Reset
                </button>
              </li>
            ))}
          </ul>
          {done && (
            <p className="t-14" role="status" style={{ marginTop: 12 }}>
              {done}
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}

export function HistoryScreen() {
  const history = useStore((s) => s.history);
  const go = useStore((s) => s.go);
  const setupMode = useStore((s) => s.setup.mode);
  const [mode, setMode] = React.useState<ModeChoice>(setupMode);
  const [detail, setDetail] = React.useState<SessionResult | null>(null);
  const [deleted, setDeleted] = React.useState<SessionResult | null>(null);
  const restoreSession = useStore((s) => s.restoreSession);
  // The Undo offer lasts eight seconds.
  React.useEffect(() => {
    if (!deleted) return;
    const t = window.setTimeout(() => setDeleted(null), 8000);
    return () => window.clearTimeout(t);
  }, [deleted]);
  const forMode = history.filter((h) => h.requestedMode === mode && !h.guided);
  const series = [...forMode].reverse().slice(-20);

  return (
    <main className="screen paper">
      <div className="back-row">
        <button className="icon-btn" onClick={() => go("home")} aria-label="Back to Home" style={{ marginLeft: -12 }}>
          <BackIcon />
        </button>
      </div>
      <h1 className="display page-title">History</h1>
      {history.length === 0 ? (
        <>
          <p className="empty">No sessions yet. Start one and your first result becomes your baseline.</p>
          <div className="grow" />
          <button className="btn-primary" onClick={() => go("home")}>
            Go to Start
          </button>
        </>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Mode">
            {MODE_CHOICES.map((m) => (
              <button key={m} role="radio" aria-checked={m === mode} className="chip" onClick={() => setMode(m)}>
                {MODE_INFO[m].label}
              </button>
            ))}
          </div>
          {forMode.length === 0 ? (
            <p className="empty" style={{ fontSize: "var(--fs-17)" }}>
              No {MODE_INFO[mode].label} sessions yet. Pick another mode above, or choose {MODE_INFO[mode].label} under Change on Home.
            </p>
          ) : (
            <>
              <Trend title="Accuracy" values={series.map((h) => ({ v: h.accuracy, t: h.startedAt }))} format={(v) => `${pct(v)}%`} />
              <Trend title="Response time" values={series.map((h) => ({ v: h.avgRt, t: h.startedAt }))} format={secs} invert />
            </>
          )}
          <ConsistencyStrip history={history} />
          <Levels />
          <h2 className="t-24" style={{ marginTop: 28, fontWeight: 700 }}>
            Sessions
          </h2>
          <div className="session-list">
            {history.map((h) => (
              <button key={h.id} className="session-item" onClick={() => setDetail(h)} data-activity={h.activity}>
                <span className="swatch" aria-hidden="true" />
                <span className="stack">
                  <span className="t-17" style={{ fontWeight: 650 }}>
                    {h.daily
                      ? `Daily #${dailyNumber(h.daily)}`
                      : `${ACTIVITY_LABEL[h.activity]}, ${h.guided ? "first round" : MODE_INFO[h.requestedMode].label}`}
                  </span>
                  <span className="meta">
                    {new Date(h.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, {minutesLabel(h.durationSeconds)}, {h.challenges}{" "}
                    challenges
                  </span>
                </span>
                <span className="acc num">{pct(h.accuracy)}%</span>
              </button>
            ))}
          </div>
        </>
      )}
      {detail && <Detail r={detail} onClose={() => setDetail(null)} onDeleted={setDeleted} />}
      {deleted && (
        <div className="toast" role="status">
          <span>Session deleted.</span>
          <button
            className="btn-text"
            onClick={() => {
              restoreSession(deleted);
              setDeleted(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </main>
  );
}
