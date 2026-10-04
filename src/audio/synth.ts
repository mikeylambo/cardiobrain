// All sound is synthesized: nothing to download, nothing to cache.
// Everything routes through one master gain and a compressor so the chime, the low note
// and the chords land at the same perceived loudness, with a conservative peak for earbuds.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): { ctx: AudioContext; out: AudioNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp).connect(ctx.destination);
  }
  return master ? { ctx, out: master } : null;
}

/** iOS Safari only starts audio from inside a user gesture. Call on the first tap. */
export function unlockAudio(): void {
  const a = audio();
  if (a && a.ctx.state === "suspended") void a.ctx.resume().catch(() => undefined);
}

function tone(freq: number, dur: number, level: number, delay = 0, type: OscillatorType = "sine"): void {
  if (!enabled) return;
  const a = audio();
  if (!a || a.ctx.state !== "running") return;
  const t = a.ctx.currentTime + delay;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  // Lower notes need more energy to sound as loud; scale level against a 660Hz reference.
  const comp = Math.min(1.6, Math.sqrt(660 / freq));
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level * comp, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const RECALL_NOTES: Record<string, number> = {
  circle: 523.25,
  square: 587.33,
  triangle: 659.25,
  diamond: 783.99,
  star: 880,
  cross: 987.77,
};

export const sfx = {
  tick: () => tone(740, 0.06, 0.18, 0, "triangle"),
  go: () => tone(988, 0.14, 0.2, 0, "triangle"),
  correct: () => {
    tone(784, 0.09, 0.2);
    tone(1046.5, 0.14, 0.18, 0.07);
  },
  wrong: () => tone(196, 0.16, 0.22, 0, "triangle"),
  streak: (n: number) => {
    const notes = n >= 25 ? [784, 988, 1175, 1568] : n >= 10 ? [784, 988, 1175] : [784, 1046.5];
    notes.forEach((f, i) => tone(f, 0.16, 0.17, i * 0.08));
  },
  switch: () => {
    tone(440, 0.07, 0.18, 0, "square");
    tone(330, 0.09, 0.14, 0.07, "square");
  },
  symbol: (shape: string) => tone(RECALL_NOTES[shape] ?? 660, 0.16, 0.16),
  count: () => tone(1200, 0.025, 0.08, 0, "triangle"),
  complete: () => {
    [523.25, 659.25, 783.99].forEach((f) => tone(f, 0.5, 0.12));
    tone(1046.5, 0.6, 0.1, 0.12);
  },
  transition: () => tone(659.25, 0.12, 0.16, 0, "triangle"),
};
