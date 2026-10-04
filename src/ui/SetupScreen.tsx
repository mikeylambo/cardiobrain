import { motion } from "framer-motion";
import type { Activity, DurationChoice } from "../engine/types";
import { CORE_MODE_IDS, MODE_REGISTRY } from "../modes/registry";
import { getDurationLabel, useCardioStore } from "../state/store";

const activities: Array<{ id: Activity; label: string; copy: string }> = [
  { id: "walk", label: "Walk", copy: "Plenty of attention to spare." },
  { id: "bike", label: "Bike", copy: "Steady rhythm, rolling pace." },
  { id: "stairs", label: "Stairs", copy: "Extra room for heavy breathing." },
  { id: "run", label: "Run", copy: "Fast legs, simpler choices." }
];
const durations: DurationChoice[] = [10, 20, 30, "open"];
const wordsMode = MODE_REGISTRY.rhyme;

export function SetupScreen({ onBack }: { onBack: () => void }) {
  const setup = useCardioStore((s) => s.setup);
  const setSetup = useCardioStore((s) => s.setSetup);
  const start = useCardioStore((s) => s.startCountdown);

  return (
    <main className="app-frame screen-stack">
      <div className="topbar"><button className="icon-button" onClick={onBack} aria-label="Back">←</button><div className="eyebrow">SESSION SETUP</div><div style={{ width: 44 }} /></div>
      <div><h1 className="section-title">Build the<br />right session.</h1><p className="body-copy">Your activity changes the timing, not the goal.</p></div>

      <section><div className="eyebrow" style={{ marginBottom: 10 }}>ACTIVITY</div><div className="activity-grid">
        {activities.map(item => <button key={item.id} className={`choice-card ${setup.activity === item.id ? "selected" : ""}`} onClick={() => setSetup({ activity: item.id })}>
          <div style={{ fontSize: 22, marginBottom: 14 }} aria-hidden="true">{item.id === "walk" ? "↟" : item.id === "bike" ? "◒" : item.id === "stairs" ? "⇧" : "⌁"}</div>
          <div className="choice-title">{item.label}</div><div className="choice-copy">{item.copy}</div>
        </button>)}
      </div></section>

      <section><div className="eyebrow" style={{ marginBottom: 10 }}>MODE</div><div className="mode-grid">
        <button className={`mode-card ${setup.mode === "mix" ? "selected" : ""}`} onClick={() => setSetup({ mode: "mix" })}><strong>Mix</strong><p>Rotate through every core mode.</p></button>
        {CORE_MODE_IDS.map(id => { const mode = MODE_REGISTRY[id]; return <button key={id} className={`mode-card ${setup.mode === id ? "selected" : ""}`} onClick={() => setSetup({ mode: id })}><strong>{mode.label}</strong><p>{mode.description}</p></button>; })}
      </div></section>

      <section><div className="eyebrow" style={{ marginBottom: 10 }}>DURATION</div><div className="duration-row">{durations.map(value => <button key={String(value)} className={`chip ${setup.duration === value ? "selected" : ""}`} onClick={() => setSetup({ duration: value })}>{getDurationLabel(value)}</button>)}</div></section>

      <motion.button whileTap={{ scale: 0.985 }} className="action-primary" onClick={start}>Continue to countdown</motion.button>
    </main>
  );
}
