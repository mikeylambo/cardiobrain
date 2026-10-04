// Spoken prompts. Web Speech in browsers (and iOS WKWebView); the Capacitor TTS plugin
// in the native apps, because Android's WebView has no speechSynthesis.
import { isNative } from "../platform/native";

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|premium|enhanced|samantha|google/i.test(v.name)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null
  );
}

if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.addEventListener?.("voiceschanged", () => (voice = pickVoice()));
}

export const isSpeechSupported = () => isNative || typeof speechSynthesis !== "undefined";

let primed = false;
/**
 * iOS Safari only lets a page speak after speech has started inside a user gesture. The
 * first real prompt arrives after the countdown, outside any tap, so the Start tap calls
 * this to speak a silent utterance and unlock speech for the session.
 */
export function primeSpeech(): void {
  if (primed || isNative || typeof speechSynthesis === "undefined") return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    primed = true;
  } catch {
    // Nothing to unlock.
  }
}

/** Say it now, cutting off anything still being said. */
export function say(text: string): void {
  if (!text) return;
  if (isNative) {
    void import("@capacitor-community/text-to-speech")
      .then(async ({ TextToSpeech }) => {
        await TextToSpeech.stop().catch(() => undefined);
        await TextToSpeech.speak({ text, lang: "en-US", rate: 1.05, volume: 1, category: "playback" });
      })
      .catch(() => undefined);
    return;
  }
  if (typeof speechSynthesis === "undefined") return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice ??= pickVoice();
    if (voice) u.voice = voice;
    u.lang = "en-US";
    u.rate = 1.08;
    speechSynthesis.speak(u);
  } catch {
    // Speech is an extra; the screen still carries the challenge.
  }
}

export function hush(): void {
  if (isNative) {
    void import("@capacitor-community/text-to-speech").then(({ TextToSpeech }) => TextToSpeech.stop()).catch(() => undefined);
    return;
  }
  try {
    speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}

const POSITIONS_2 = ["Left", "Right"];
const POSITIONS_4 = ["Top left", "Top right", "Bottom left", "Bottom right"];
const POSITIONS_6 = ["Top left", "Top middle", "Top right", "Bottom left", "Bottom middle", "Bottom right"];

/** "Left, odd. Right, even." For eyes-free play, where the tile's place is the answer. */
export function readOptions(labels: string[]): string {
  const pos = labels.length === 2 ? POSITIONS_2 : labels.length <= 4 ? POSITIONS_4 : POSITIONS_6;
  return labels.map((l, i) => `${pos[i]}, ${l.replace(/−/g, "minus ")}.`).join(" ");
}
