import { describe, expect, it } from "vitest";
import { motionRows } from "../insights";
import { dailyKey } from "../daily";
import { challengeLink, parseStartLink } from "../../platform/links";
import { rivalText } from "../../ui/copy";
import type { SessionResult } from "../types";

const s = (activity: SessionResult["activity"], mode: SessionResult["requestedMode"], accuracy: number, avgRt: number, i: number): SessionResult =>
  ({
    id: `${activity}-${mode}-${i}`,
    activity,
    requestedMode: mode,
    accuracy,
    avgRt,
    challenges: 20,
    startedAt: i,
    finishedAt: i,
    trials: [],
  }) as unknown as SessionResult;

describe("challenge links", () => {
  it("round-trip a daily and a score", () => {
    const link = challengeLink("2026-10-04", 0.876);
    expect(link).toBe("https://cardiobrain.vercel.app/?daily=2026-10-04&beat=88");
    expect(parseStartLink(link)).toEqual({ daily: "2026-10-04", beat: 88 });
  });
  it("ignore future days, pre-launch days, bad dates and bad scores", () => {
    expect(parseStartLink("https://x.app/?daily=2999-01-01&beat=50")).toEqual({ daily: true });
    expect(parseStartLink("https://x.app/?daily=2020-01-01&beat=50")).toEqual({ daily: true });
    expect(parseStartLink("https://x.app/?daily=yesterday&beat=50")).toEqual({ daily: true });
    expect(parseStartLink(`https://x.app/?daily=${dailyKey()}&beat=101`)).toEqual({ daily: dailyKey() });
    expect(parseStartLink(`https://x.app/?daily=${dailyKey()}&beat=8.5`)).toEqual({ daily: dailyKey() });
  });
  it("describe the outcome", () => {
    expect(rivalText(0.92, 88)).toBe("You beat your friend's 88% by 4 points.");
    expect(rivalText(0.88, 88)).toBe("Tied with your friend's 88%.");
    expect(rivalText(0.87, 88)).toBe("1 point short of your friend's 88%.");
  });
});

describe("seated vs. moving rows", () => {
  it("pair each mode's seated baseline with its moving sessions, biggest cost first", () => {
    const history = [
      s("still", "numbers", 0.9, 800, 1),
      s("walk", "numbers", 0.8, 900, 2),
      s("run", "numbers", 0.7, 1000, 3),
      s("still", "rhyme", 0.8, 900, 4),
      s("bike", "rhyme", 0.78, 950, 5),
      s("walk", "recall", 0.6, 1200, 6),
    ];
    const rows = motionRows(history);
    expect(rows.map((r) => r.mode)).toEqual(["numbers", "rhyme"]);
    expect(rows[0]!.seatedAcc).toBeCloseTo(0.9);
    expect(rows[0]!.movingAcc).toBeCloseTo(0.75);
    expect(rows[0]!.movingN).toBe(2);
  });
});

import { spokenSummary } from "../../ui/copy";
describe("spoken summary", () => {
  it("reads the numbers that matter, then what's new", () => {
    const r = { accuracy: 0.86, challenges: 142, avgRt: 840, bestStreak: 17 } as SessionResult;
    expect(spokenSummary(r, "Sharper than your last bike session.", { accuracyPoints: 4, bests: ["accuracy", "streak"] })).toBe(
      "Sharper than your last bike session. 86 percent accuracy over 142 challenges. Correct answers in 0.84 seconds on average. 4 points above last time. Best streak, 17. New personal best: accuracy and streak.",
    );
  });
  it("stays short for a first session", () => {
    const r = { accuracy: 0.5, challenges: 1, avgRt: 0, bestStreak: 1 } as SessionResult;
    expect(spokenSummary(r, "Baseline set.", { accuracyPoints: null, bests: [] })).toBe("Baseline set. 50 percent accuracy over 1 challenge.");
  });
});
