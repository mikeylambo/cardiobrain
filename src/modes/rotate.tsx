import { SHAPES, type Cell } from "./generate/rotate";
import type { ModeViewProps } from "./shared";
import { feedbackFor, Tiles, usePresentOnPaint } from "./shared";

function Shape({ cells, angle, mirrored, label }: { cells: Cell[]; angle: number; mirrored: boolean; label: string }) {
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  return (
    <svg viewBox="-3 -3 6 6" role="img" aria-label={label}>
      <g transform={`rotate(${angle}) scale(${mirrored ? -1 : 1} 1) translate(${-cx} ${-cy})`}>
        {cells.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x - 0.01} y={y - 0.01} width={1.02} height={1.02} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}

export function RotateView({ challenge, onAnswer, onPresented, feedback }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  const { shape, angle, mirrored, baseAngle } = challenge.data as { shape: string; angle: number; mirrored: boolean; baseAngle: number };
  const cells = SHAPES[shape]!;
  return (
    <>
      <div className="stage">
        <p className="cue">{challenge.cue}</p>
        <div className="rotate-pair">
          <Shape cells={cells} angle={baseAngle} mirrored={false} label="First shape" />
          <Shape cells={cells} angle={baseAngle + angle} mirrored={mirrored} label="Second shape, turned" />
        </div>
      </div>
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} variant="label" />
    </>
  );
}
