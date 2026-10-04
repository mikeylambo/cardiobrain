import { describe, expect, it } from "vitest";
import type { SessionResult } from "../types";
import { findInsights, motionCost, motionCostText, personalBests, sessionsThisWeek, weekStart } from "../insights";

let id = 0;
const s = (p: Partial<SessionResult>): SessionResult => ({
  id: `s${id++}`,
  activity: "bike",
  requestedMode: "numbers",
  durationSeconds: 600,
  accuracy: 0.8,
  avgRt: 1000,
  medianRt: 1000,
  challenges: 100,
  bestStreak: 8,
  totalScore: 0,
  minLevel: 1,
  maxLevel: 5,
  switchCost: null,
  startedAt: Date.now() - 86_400_000,
  finishedAt: Date.now() - 86_000_000,
  trials: [],
  ...p,
});
const labels = { mode: (m: string) => m, activity: (a: string) => a };

describe("insights", () => {
  it("personal bests need history, enough challenges, and accuracy for speed", () => {
    const old = s({ accuracy: 0.8, avgRt: 1000, bestStreak: 8 });
    const r = s({ accuracy: 0.9, avgRt: 900, bestStreak: 12, finishedAt: Date.now() });
    expect(personalBests([r, old], r)).toEqual({ accuracy: true, speed: true, streak: true });
    const sloppy = s({ accuracy: 0.6, avgRt: 500, finishedAt: Date.now() });
    expect(personalBests([sloppy, old], sloppy).speed).toBe(false);
    expect(personalBests([r], r)).toEqual({ accuracy: false, speed: false, streak: false });
  });

  it("motion cost compares moving sessions with the seated baseline", () => {
    const base = s({ activity: "still", accuracy: 0.9, avgRt: 1000 });
    const moving = s({ activity: "run", accuracy: 0.84, avgRt: 1200 });
    const c = motionCost([moving, base], "numbers", [moving])!;
    expect(c.accuracyPoints).toBe(-6);
    expect(c.rtPercent).toBe(20);
    expect(motionCostText(c)).toBe("Moving, you're 20% slower than seated and 6 points less accurate.");
    expect(motionCost([moving], "numbers", [moving])).toBeNull();
  });

  it("counts this week's sessions from Monday", () => {
    const monday = weekStart();
    expect(new Date(monday).getDay()).toBe(1);
    expect(sessionsThisWeek([s({ startedAt: monday + 1000 }), s({ startedAt: monday - 1000 })])).toBe(1);
  });

  it("only reports findings with enough data and a real difference", () => {
    expect(findInsights([s({})], labels).filter((i) => i.id === "effort")).toHaveLength(0);
    const hist = [...[1, 2, 3].map(() => s({ rpe: 8, accuracy: 0.7 })), ...[1, 2, 3].map(() => s({ rpe: 4, accuracy: 0.9 }))];
    const effort = findInsights(hist, labels).find((i) => i.id === "effort");
    expect(effort?.title).toBe("Hard efforts cost you accuracy");
    expect(effort?.body).toContain("20 points lower");
  });
});

import { headline } from "../../ui/copy";
describe("results headline", () => {
  const base = s({ accuracy: 0.8, avgRt: 1000 });
  const h = (accuracy: number, avgRt: number) => headline(s({ accuracy, avgRt, finishedAt: Date.now() }), base);
  it("credits trade-offs honestly", () => {
    expect(h(0.9, 950)).toBe("Sharper than your last bike session.");
    expect(h(0.9, 1300)).toBe("More accurate, a touch slower.");
    expect(h(0.75, 800)).toBe("Faster, but less accurate than last time.");
    expect(h(0.77, 1300)).toBe("A little less accurate than last time.");
    expect(h(0.7, 1000)).toBe("Tougher than your last bike session. It happens.");
    expect(h(0.81, 850)).toBe("Just as accurate, and quicker.");
    expect(h(0.81, 1200)).toBe("Just as accurate, a touch slower.");
    expect(h(0.81, 1020)).toBe("Right in line with your last bike session.");
  });
});

import { parseStartLink } from "../../platform/links";
describe("start links", () => {
  it("reads web and app-scheme start links, ignoring unknown values", () => {
    expect(parseStartLink("https://cardiobrain.vercel.app/?start=bike")).toEqual({ activity: "bike" });
    expect(parseStartLink("https://x.app/?start=run&mode=nback")).toEqual({ activity: "run", mode: "nback" });
    expect(parseStartLink("cardiobrain://start?activity=walk&mode=numbers")).toEqual({ activity: "walk", mode: "numbers" });
    expect(parseStartLink("https://x.app/?start=daily")).toEqual({ daily: true });
    expect(parseStartLink("https://x.app/?start=skydiving")).toEqual({});
    expect(parseStartLink("https://x.app/")).toBeNull();
  });
});

import { parseHeartRate, zoneFor } from "../../platform/heartRate";
describe("heart rate", () => {
  it("parses 8-bit and 16-bit heart-rate measurements", () => {
    expect(parseHeartRate(new DataView(new Uint8Array([0x00, 142]).buffer))).toBe(142);
    expect(parseHeartRate(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer))).toBe(300);
    expect(parseHeartRate(new DataView(new Uint8Array([0x16, 88, 0, 0]).buffer))).toBe(88);
  });
  it("maps bpm to five zones of max heart rate", () => {
    expect(zoneFor(100, 190)).toBe(1);
    expect(zoneFor(125, 190)).toBe(2);
    expect(zoneFor(140, 190)).toBe(3);
    expect(zoneFor(160, 190)).toBe(4);
    expect(zoneFor(175, 190)).toBe(5);
  });
});
