import React from "react";
import type { DifficultyBias } from "../engine/types";
import { haptics } from "../haptics";
import { isSpeechSupported, say } from "../audio/speech";
import { isVoiceInputSupported } from "../audio/listen";
import { isNative, shareNative } from "../platform/native";
import { connectHeartRate, isHeartRateSupported, type HeartRateConnection } from "../platform/heartRate";
import { connectHealth, isHealthSupported } from "../platform/health";

// One strap connection for the whole app, kept outside React so leaving Settings doesn't drop it.
let strap: HeartRateConnection | null = null;
import { useStore } from "../state/store";
import { exportData } from "../storage";
import { APP_VERSION } from "../changelog";
import { ReportSheet, WhatsNewSheet } from "./AboutSheets";
import { BackIcon, Segmented, Sheet, Toggle } from "./components";

const BIAS_NOTE: Record<DifficultyBias, string> = {
  gentle: "More time to answer and a slower climb. Good for hard efforts.",
  standard: "Adapts to you as you play. Right for most sessions.",
  hard: "Less time to answer and a faster climb.",
};

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="setting">
      <div className="setting-text">
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const prefs = useStore((s) => s.prefs);
  const flags = useStore((s) => s.flags);
  const updatePrefs = useStore((s) => s.updatePrefs);
  const go = useStore((s) => s.go);
  const deleteAllData = useStore((s) => s.deleteAllData);
  const importData = useStore((s) => s.importData);
  const markBackedUp = useStore((s) => s.markBackedUp);
  const [confirm, setConfirm] = React.useState(false);
  const [about, setAbout] = React.useState<"new" | "report" | null>(null);
  const [tested, setTested] = React.useState(false);
  const [importNote, setImportNote] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const vibrates = typeof navigator !== "undefined" && "vibrate" in navigator;
  const canSpeak = isSpeechSupported();
  const canListen = isVoiceInputSupported();
  const heart = useStore((s) => s.heart);
  const setHeart = useStore((s) => s.setHeart);
  const [hrNote, setHrNote] = React.useState<string | null>(null);

  const toggleStrap = async () => {
    if (strap) {
      strap.disconnect();
      strap = null;
      setHeart(null);
      return;
    }
    try {
      setHrNote("Looking for straps…");
      strap = await connectHeartRate(
        (bpm) => setHeart(bpm, strap?.name),
        () => {
          strap = null;
          setHeart(null);
          setHrNote("Strap disconnected.");
        },
      );
      setHrNote(`Connected to ${strap.name}.`);
    } catch (e) {
      strap = null;
      setHrNote((e as Error)?.name === "NotFoundError" ? "No strap chosen." : "Couldn't connect. Wake the strap (wet the contacts) and try again.");
    }
  };

  const backup = async () => {
    const s = useStore.getState();
    const payload = { app: "CardioBrain", version: APP_VERSION, history: s.history, progress: s.progress, prefs: s.prefs, setup: s.setup };
    if (isNative) {
      // In the app: hand the file to the share sheet, so it can go to Files, iCloud Drive or Google Drive.
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2)], { type: "application/json" });
      await shareNative(blob, "CardioBrain backup").catch(() => undefined);
    } else exportData(payload);
    markBackedUp();
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setImportNote(await importData(await file.text()));
    if (fileInput.current) fileInput.current.value = "";
  };

  const lastBackup = flags.lastBackupAt ? new Date(flags.lastBackupAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

  return (
    <main className="screen paper">
      <div className="back-row">
        <button className="icon-btn" onClick={() => go("home")} aria-label="Back to Home" style={{ marginLeft: -12 }}>
          <BackIcon />
        </button>
      </div>
      <h1 className="display page-title">Settings</h1>

      <h2 className="settings-group">Sound and voice</h2>
      <Row title="Sound" note="Chimes for right and wrong answers.">
        <Toggle label="Sound" checked={prefs.sound} onChange={(sound) => updatePrefs({ sound })} />
      </Row>
      <Row
        title="Haptics"
        note={tested && !vibrates && !isNative ? "This browser can't vibrate. Sound and visuals carry feedback." : "A short buzz with each answer."}
      >
        <div className="btn-row" style={{ gap: 12 }}>
          <button
            className="btn-text"
            onClick={() => {
              haptics.test();
              setTested(true);
            }}
            disabled={!prefs.haptics}
          >
            Test
          </button>
          <Toggle label="Haptics" checked={prefs.haptics} onChange={(h) => updatePrefs({ haptics: h })} />
        </div>
      </Row>
      <div className="setting setting-stack">
        <div className="setting-text">
          <strong>Tap feedback</strong>
          <span>How much each press answers back: a tick, a buzz and a little give.</span>
        </div>
        <Segmented
          label="Tap feedback"
          cols={3}
          value={prefs.feedback}
          onChange={(feedback) => updatePrefs({ feedback })}
          options={[
            { value: "off", label: "Off" },
            { value: "standard", label: "Standard" },
            { value: "strong", label: "Strong" },
          ]}
        />
      </div>
      <Row title="Read challenges aloud" note={canSpeak ? "Hear each challenge through your earbuds, so you can look up less." : "This browser can't speak."}>
        <div className="btn-row" style={{ gap: 12 }}>
          <button className="btn-text" disabled={!canSpeak} onClick={() => say("Forty seven plus thirty eight.")}>
            Test
          </button>
          <Toggle label="Read challenges aloud" checked={prefs.speak && canSpeak} onChange={(speak) => updatePrefs({ speak })} />
        </div>
      </Row>
      <Row title="Eyes-free" note="Also reads the answers with their places: left, right, top, bottom. Best for running outdoors.">
        <Toggle label="Eyes-free" checked={prefs.eyesFree} onChange={(eyesFree) => updatePrefs({ eyesFree, speak: eyesFree ? true : prefs.speak })} />
      </Row>
      <Row
        title="Answer by voice"
        note={
          canListen
            ? "Say the answer. Works in every mode except React and Recall, which need taps."
            : "This browser can't listen. Chrome, Edge and Safari can."
        }
      >
        <Toggle label="Answer by voice" checked={prefs.voiceAnswers && canListen} onChange={(voiceAnswers) => updatePrefs({ voiceAnswers })} />
      </Row>

      <h2 className="settings-group">Display</h2>
      <div className="setting setting-stack">
        <div className="setting-text">
          <strong>Screen distance</strong>
          <span>Arm's length makes the session bigger, for phones on a treadmill or climber.</span>
        </div>
        <Segmented
          label="Screen distance"
          cols={2}
          value={prefs.distance}
          onChange={(distance) => updatePrefs({ distance })}
          options={[
            { value: "hand", label: "In hand" },
            { value: "arm", label: "Arm's length" },
          ]}
        />
      </div>
      <Row title="Dark sessions" note="A dark background with your activity color on the challenge. Easier at night.">
        <Toggle label="Dark sessions" checked={prefs.darkSessions} onChange={(darkSessions) => updatePrefs({ darkSessions })} />
      </Row>
      <Row title="Reduced motion" note="Quick fades instead of wipes and width changes.">
        <Toggle label="Reduced motion" checked={prefs.reducedMotion} onChange={(reducedMotion) => updatePrefs({ reducedMotion })} />
      </Row>

      <h2 className="settings-group">Training</h2>
      <div className="setting setting-stack">
        <div className="setting-text">
          <strong>Difficulty</strong>
          <span>{BIAS_NOTE[prefs.difficultyBias]}</span>
        </div>
        <Segmented
          label="Difficulty"
          cols={3}
          value={prefs.difficultyBias}
          onChange={(difficultyBias) => updatePrefs({ difficultyBias })}
          options={[
            { value: "gentle", label: "Gentle" },
            { value: "standard", label: "Standard" },
            { value: "hard", label: "Hard" },
          ]}
        />
      </div>
      <div className="setting setting-stack">
        <div className="setting-text">
          <strong>Weekly goal</strong>
          <span>Sessions per week, shown as the ring on Home.</span>
        </div>
        <Segmented
          label="Weekly goal"
          cols={5}
          value={prefs.weeklyGoal}
          onChange={(weeklyGoal) => updatePrefs({ weeklyGoal })}
          options={[2, 3, 4, 5, 7].map((n) => ({ value: n, label: String(n) }))}
        />
      </div>
      <Row title="Mood check-in" note="One tap before and after each session. Insights will show how sessions leave you feeling.">
        <Toggle label="Mood check-in" checked={prefs.moodCheckIn} onChange={(moodCheckIn) => updatePrefs({ moodCheckIn })} />
      </Row>

      <h2 className="settings-group">Heart rate</h2>
      <Row
        title="Heart-rate strap"
        note={
          isHeartRateSupported()
            ? heart
              ? `${heart.bpm} bpm now. Harder zones get more time to answer.`
              : (hrNote ?? "Any Bluetooth chest strap. Harder zones get more time to answer.")
            : "This browser can't use Bluetooth. Chrome on Android or a computer can."
        }
      >
        <button className="btn-text" disabled={!isHeartRateSupported()} onClick={() => void toggleStrap()}>
          {strap ? "Disconnect" : "Connect"}
        </button>
      </Row>
      <div className="setting">
        <div className="setting-text">
          <strong>Max heart rate</strong>
          <span>Sets your zones. 220 minus your age is a rough start; a tested max is better.</span>
        </div>
        <div className="stepper">
          <button className="icon-btn" aria-label="Lower max heart rate" onClick={() => updatePrefs({ maxHr: Math.max(140, prefs.maxHr - 1) })}>
            −
          </button>
          <span className="num" aria-live="polite">
            {prefs.maxHr}
          </span>
          <button className="icon-btn" aria-label="Raise max heart rate" onClick={() => updatePrefs({ maxHr: Math.min(220, prefs.maxHr + 1) })}>
            +
          </button>
        </div>
      </div>
      {isHealthSupported() && (
        <Row title="Log to Health" note="Write each session to Apple Health or Health Connect as mindful minutes.">
          <Toggle
            label="Log to Health"
            checked={prefs.logToHealth}
            onChange={(on) => {
              if (!on) updatePrefs({ logToHealth: false });
              else void connectHealth().then((ok) => updatePrefs({ logToHealth: ok }));
            }}
          />
        </Row>
      )}

      <h2 className="settings-group">Your data</h2>
      <p className="t-14" style={{ color: "var(--muted)" }}>
        Everything stays on this device. Back it up to move to a new phone. {lastBackup ? `Last backup ${lastBackup}.` : "No backup yet."}
      </p>
      <div className="danger-zone">
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => void backup()}>
          Back up (export)
        </button>
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => fileInput.current?.click()}>
          Restore from a backup (import)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onImport(e.target.files?.[0])}
          aria-label="Choose a backup file"
        />
        {importNote && (
          <p className="t-17" role="status">
            {importNote}
          </p>
        )}
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>
          Delete data
        </button>
      </div>
      {!isNative && (
        <Row
          title="Share anonymous usage"
          note="Which screens and modes get used, to guide what improves next. No cookies, no personal data, no results. Off unless you turn it on."
        >
          <Toggle label="Share anonymous usage" checked={prefs.analytics} onChange={(analytics) => updatePrefs({ analytics })} />
        </Row>
      )}

      <h2 className="settings-group">About</h2>
      <p className="about-version">CardioBrain {APP_VERSION}</p>
      <div className="danger-zone">
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setAbout("new")}>
          What's new
        </button>
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setAbout("report")}>
          Report a problem
        </button>
        <p className="t-14" style={{ color: "var(--muted)", marginTop: 8 }}>
          <a href="/privacy" style={{ color: "inherit" }}>
            Privacy
          </a>
        </p>
      </div>
      {about === "new" && <WhatsNewSheet onClose={() => setAbout(null)} />}
      {about === "report" && <ReportSheet onClose={() => setAbout(null)} />}

      {confirm && (
        <Sheet title="Delete everything?" onClose={() => setConfirm(false)}>
          <p className="t-17" style={{ marginBottom: 20 }}>
            This removes your history, levels and settings from this device. It can't be undone.
          </p>
          <div className="stack gap-8">
            <button
              className="btn-primary"
              onClick={() => {
                setConfirm(false);
                void deleteAllData();
              }}
            >
              Delete data
            </button>
            <button className="btn-text" style={{ alignSelf: "center" }} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
