import type { Challenge, Generator } from "../../engine/types";
import { ACTIVITY_RESPONSE_MULTIPLIER, targetResponseMs } from "../../engine/difficulty";

export const ZONES = ["tl", "tr", "bl", "br"] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_LABEL: Record<Zone, string> = {
  tl: "Top left",
  tr: "Top right",
  bl: "Bottom left",
  br: "Bottom right",
};
export const WITHHOLD = "withhold";

/**
 * React: a solid circle appears in one of four positions that mirror the four tiles;
 * tap the matching tile. From level 4 some trials are no-go (a square): do not tap.
 * From level 8 a hollow decoy ring sits in another position.
 */
export const generateReact: Generator = (level, rng, ctx): Challenge => {
  const zone = ZONES[Math.floor(rng() * 4)]!;
  const noGo = level >= 4 && rng() < Math.min(0.28, 0.12 + level * 0.01);
  let decoy: Zone | null = null;
  if (level >= 8 && !noGo && rng() < 0.6) {
    const others = ZONES.filter((z) => z !== zone);
    decoy = others[Math.floor(rng() * others.length)]!;
  }
  const window = Math.round(
    Math.max(650, 1500 - level * 40) * ACTIVITY_RESPONSE_MULTIPLIER[ctx.activity] * (ctx.bias === "gentle" ? 1.15 : ctx.bias === "hard" ? 0.9 : 1),
  );
  // Each trial waits a short random beat before the target lands, so it cannot be anticipated.
  const delayMs = 350 + Math.floor(rng() * 650);
  return {
    id: `react-${ctx.trialIndex}-${level}`,
    mode: "react",
    level,
    cue: noGo ? "Hold" : "Tap where it lands",
    prompt: "",
    options: ZONES.map((z) => ({ id: z, label: ZONE_LABEL[z] })),
    correctAnswer: noGo ? WITHHOLD : zone,
    timeoutMs: window,
    timeoutAnswer: WITHHOLD,
    voice: false,
    targetRt: targetResponseMs("react", level, ctx.activity, ctx.bias),
    data: { zone, noGo, decoy, delayMs },
  };
};
