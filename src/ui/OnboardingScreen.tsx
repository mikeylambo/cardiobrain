import { motion } from "framer-motion";
import React from "react";
import { useCardioStore } from "../state/store";

const cards = [
  { kicker: "01 / GLANCE", title: "One screen. One tap.", copy: "CardioBrain keeps the decision small so the workout can stay big.", symbol: "◉" },
  { kicker: "02 / ADAPT", title: "It meets you there.", copy: "Difficulty responds to accuracy and pace, with extra room when your activity gets harder.", symbol: "↗" },
  { kicker: "03 / TRACK", title: "Make the session count.", copy: "Your results, streaks, and trends stay on your device. No account required.", symbol: "∞" }
];

export function OnboardingScreen() {
  const [page, setPage] = React.useState(0);
  const complete = useCardioStore((s) => s.completeOnboarding);
  const card = cards[page]!;
  return (
    <main className="app-frame">
      <div className="onboarding">
        <div className="onboarding-visual">
          <motion.div key={page} initial={{ opacity: 0, scale: 0.82, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.45 }} className="orbit">
            <div style={{ position: "absolute", inset: "0", display: "grid", placeItems: "center", fontSize: "42px", fontWeight: 900, color: "var(--activity)" }}>{card.symbol}</div>
          </motion.div>
        </div>
        <div>
          <div className="eyebrow">{card.kicker}</div>
          <h1 className="section-title" style={{ marginTop: 8 }}>{card.title}</h1>
          <p className="body-copy" style={{ fontSize: 16, maxWidth: 400 }}>{card.copy}</p>
        </div>
        <div className="stat-row">
          {cards.map((_, i) => <div key={i} style={{ height: 4, borderRadius: 4, background: i === page ? "var(--activity)" : "rgba(255,255,255,.1)" }} />)}
        </div>
        <button className="action-primary" onClick={() => page === cards.length - 1 ? complete() : setPage(page + 1)}>
          {page === cards.length - 1 ? "Set up a session" : "Continue"}
        </button>
      </div>
    </main>
  );
}
