import React from "react";
import type { MotionRow } from "../engine/insights";
import { MODE_INFO } from "../modes/registry";
import { pct, secs } from "./copy";

/**
 * Seated vs. moving accuracy per mode, as a dumbbell: a hollow dot for seated, a solid dot for
 * moving, the gap between them is the motion cost. Shape carries identity, so it reads without color.
 */
export function MotionChart({ rows }: { rows: MotionRow[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const all = rows.flatMap((r) => [r.seatedAcc, r.movingAcc]);
  const lo = Math.max(0, Math.floor((Math.min(...all) * 100 - 5) / 10) * 10);
  const x = (acc: number) => ((acc * 100 - lo) / (100 - lo)) * 100;
  const ticks = [lo, Math.round((lo + 100) / 2), 100];
  const detail = active !== null ? rows[active] : null;

  return (
    <figure className="motion-chart">
      <figcaption className="motion-legend">
        <span>
          <i className="dot seated" aria-hidden="true" /> Seated
        </span>
        <span>
          <i className="dot moving" aria-hidden="true" /> Moving
        </span>
        <span className="motion-unit">Accuracy</span>
      </figcaption>
      <div className="motion-rows" onPointerLeave={() => setActive(null)}>
        {rows.map((r, i) => {
          const a = x(r.seatedAcc);
          const b = x(r.movingAcc);
          const diff = pct(r.movingAcc) - pct(r.seatedAcc);
          return (
            <div
              key={r.mode}
              className={`motion-row${active === i ? " on" : ""}`}
              tabIndex={0}
              role="img"
              aria-label={`${MODE_INFO[r.mode].label}: seated ${pct(r.seatedAcc)}%, moving ${pct(r.movingAcc)}%`}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="motion-label">{MODE_INFO[r.mode].label}</span>
              <span className="motion-track">
                {ticks.map((t) => (
                  <i key={t} className="motion-grid" style={{ left: `${x(t / 100)}%` }} aria-hidden="true" />
                ))}
                <i className="motion-bar" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} aria-hidden="true" />
                <i className="dot seated" style={{ left: `${a}%` }} aria-hidden="true" />
                <i className="dot moving" style={{ left: `${b}%` }} aria-hidden="true" />
              </span>
              <span className="motion-diff num">{diff === 0 ? "±0" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}</span>
            </div>
          );
        })}
        <div className="motion-row axis" aria-hidden="true">
          <span />
          <span className="motion-track">
            {ticks.map((t) => (
              <span key={t} className="motion-tick num" style={{ left: `${x(t / 100)}%` }}>
                {t}%
              </span>
            ))}
          </span>
          <span className="motion-diff">pts</span>
        </div>
      </div>
      <p className="motion-detail t-14" aria-live="polite">
        {detail
          ? `${MODE_INFO[detail.mode].label}: seated ${pct(detail.seatedAcc)}% at ${secs(detail.seatedRt)} (${detail.seatedN} ${detail.seatedN === 1 ? "session" : "sessions"}), moving ${pct(detail.movingAcc)}% at ${secs(detail.movingRt)} (${detail.movingN}).`
          : "Tap a row for the numbers behind it."}
      </p>
      <table className="sr-only">
        <caption>Accuracy and response time, seated vs. moving</caption>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Seated</th>
            <th>Moving</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mode}>
              <td>{MODE_INFO[r.mode].label}</td>
              <td>
                {pct(r.seatedAcc)}%, {secs(r.seatedRt)}
              </td>
              <td>
                {pct(r.movingAcc)}%, {secs(r.movingRt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
