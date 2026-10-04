let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

export async function unlockAudio(): Promise<void> {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
}

function tone(frequency: number, duration: number, gainAmount: number, delay = 0): void {
  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  countdown: (n: number) => tone(n === 1 ? 520 : 420, 0.08, 0.045),
  correct: () => { tone(660, 0.08, 0.04); tone(880, 0.12, 0.035, 0.07); },
  wrong: () => tone(210, 0.11, 0.028),
  milestone: () => { tone(523, 0.12, 0.045); tone(659, 0.14, 0.04, 0.09); tone(784, 0.18, 0.036, 0.18); },
  rule: () => tone(330, 0.06, 0.03),
  done: () => { tone(440, 0.12, 0.04); tone(660, 0.18, 0.035, 0.1); tone(990, 0.22, 0.03, 0.2); }
};
