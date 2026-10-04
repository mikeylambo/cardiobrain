import type { SessionResult } from "../engine/types";
import { MODE_INFO } from "../modes/registry";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, ACTIVITY_ON, accuracyDeltaText, minutesLabel, pct, rtDeltaText, secs, type Deltas } from "./copy";

const W = 1080;
const H = 1350;
const PAD = 84;

/** Same poster as the Results screen: field color, giant accuracy, three plain stats, the wordmark small at the bottom. */
export async function renderShareCard(result: SessionResult, title: string, d: Deltas): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const field = ACTIVITY_COLOR[result.activity];
  const ink = ACTIVITY_ON[result.activity];
  const font = (weight: number, size: number, stretch: "condensed" | "normal" = "normal") => {
    // fontStretch keyword maps onto Archivo's width axis where the browser supports it.
    (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = stretch === "condensed" ? "ultra-condensed" : "normal";
    ctx.font = `${weight} ${size}px Archivo, "Arial Narrow", sans-serif`;
  };

  ctx.fillStyle = field;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";

  font(600, 40);
  ctx.fillText(`${ACTIVITY_LABEL[result.activity]}, ${MODE_INFO[result.requestedMode].label}`, PAD, PAD + 40);

  font(800, 84, "condensed");
  wrap(ctx, title, PAD, PAD + 170, W - PAD * 2, 88);

  font(800, 440, "condensed");
  const score = String(pct(result.accuracy));
  ctx.fillText(score, PAD - 12, 860);
  const scoreWidth = ctx.measureText(score).width;
  font(800, 110, "condensed");
  ctx.fillText("%", PAD + scoreWidth, 560);

  const stats: Array<[string, string, string]> = [
    ["Duration", minutesLabel(result.durationSeconds), ""],
    ["Challenges", String(result.challenges), `Best streak ${result.bestStreak}`],
    ["Average response", secs(result.avgRt), rtDeltaText(d.rtSeconds)],
  ];
  let y = 960;
  font(600, 34);
  ctx.fillText(accuracyDeltaText(d.accuracyPoints), PAD, 920);
  for (const [label, value, note] of stats) {
    ctx.fillRect(PAD, y, W - PAD * 2, 4);
    font(600, 38);
    ctx.fillText(label, PAD, y + 62);
    font(800, 52, "condensed");
    const vw = ctx.measureText(value).width;
    ctx.fillText(value, W - PAD - vw, y + 64);
    if (note) {
      font(500, 28);
      ctx.fillText(note, PAD, y + 104);
    }
    y += 122;
  }

  // Wordmark, small, bottom left.
  drawMark(ctx, PAD, H - PAD - 40, 40, ink);
  font(800, 40, "condensed");
  ctx.fillText("CardioBrain", PAD + 54, H - PAD - 6);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the card"))), "image/png"));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  // Ring from -70deg the long way round to -20deg, leaving the upper-right break for the dot.
  ctx.arc(32, 32, 22, (-70 * Math.PI) / 180, (-20 * Math.PI) / 180, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(47.56, 16.44, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
