// Voice answers. Web Speech Recognition where the browser has it (Chrome, Edge, Safari),
// the Capacitor speech-recognition plugin in the native apps. Untested on a real phone:
// the native path needs a device to verify.
import { isNative } from "../platform/native";

type Ctor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const WebRecognition: Ctor | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition)
    : undefined;

export const isVoiceInputSupported = () => isNative || Boolean(WebRecognition);

export interface Listener {
  stop: () => void;
}

/**
 * Listen continuously and hand every transcript (interim ones too, so answers land
 * fast) to onHeard. Restarts itself when the recogniser times out.
 */
export function listen(onHeard: (transcript: string) => void, onError: (message: string) => void): Listener {
  let stopped = false;
  if (isNative) {
    let remove: (() => void) | null = null;
    void (async () => {
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== "granted") {
          onError("Microphone access is off. Turn it on in Settings to answer by voice.");
          return;
        }
        const handle = await SpeechRecognition.addListener("partialResults", (d: { matches?: string[] }) => {
          if (d.matches?.[0]) onHeard(d.matches[0]);
        });
        remove = () => void handle.remove();
        const loop = async () => {
          while (!stopped) {
            await SpeechRecognition.start({ language: "en-US", partialResults: true, popup: false }).catch(() => undefined);
          }
        };
        void loop();
      } catch {
        onError("Voice answers aren't available on this device.");
      }
    })();
    return {
      stop: () => {
        stopped = true;
        remove?.();
        void import("@capacitor-community/speech-recognition").then(({ SpeechRecognition }) => SpeechRecognition.stop()).catch(() => undefined);
      },
    };
  }

  if (!WebRecognition) {
    onError("This browser can't listen. Try Chrome, Edge or Safari.");
    return { stop: () => undefined };
  }
  const rec = new WebRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    if (r?.[0]) onHeard(r[0].transcript);
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopped = true;
      onError("Microphone access is blocked. Allow it for this site to answer by voice.");
    }
  };
  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start();
      } catch {
        // Already restarting.
      }
    }
  };
  try {
    rec.start();
  } catch {
    onError("Couldn't start listening.");
  }
  return {
    stop: () => {
      stopped = true;
      try {
        rec.abort();
      } catch {
        // Already stopped.
      }
    },
  };
}
