import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { currentElapsedSeconds, modeLabel, useCardioStore } from "../state/store";

const fmt = (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : "—";
const durationLabel = (s: number) => s < 60 ? `${Math.max(1, Math.round(s))}s` : `${Math.round(s / 60)}m`;

export function BottomNav({ active, navigate }: { active: "home"|"history"|"settings"; navigate:(screen:"home"|"setup"|"history"|"settings")=>void }) {
  return <nav className="bottom-nav" aria-label="Primary">
    <button className={`nav-button ${active==="home"?"active":""}`} onClick={()=>navigate("home")}>HOME</button>
    <button className={`nav-button ${active==="history"?"active":""}`} onClick={()=>navigate("history")}>HISTORY</button>
    <button className={`nav-button ${active==="settings"?"active":""}`} onClick={()=>navigate("settings")}>SETTINGS</button>
  </nav>;
}

export function HomeScreen({ navigate }: { navigate:(screen:"home"|"setup"|"history"|"settings")=>void }) {
  const history=useCardioStore(s=>s.history);
  const active=useCardioStore(s=>s.active);
  const resumeAvailable=useCardioStore(s=>s.resumeAvailable);
  const start=useCardioStore(s=>s.startCountdown);
  const setScreen=useCardioStore(s=>s.setScreen);
  const resume=useCardioStore(s=>s.resumeSession);
  const setSetup=useCardioStore(s=>s.setSetup);
  const last=history[0];
  const [a2hs,setA2hs]=React.useState(false);

  const streak=React.useMemo(()=>{
    const dates=new Set(history.map(x=>new Date(x.finishedAt).toISOString().slice(0,10)));
    let n=0; const d=new Date();
    while(dates.has(d.toISOString().slice(0,10))){n++;d.setDate(d.getDate()-1);}
    return n;
  },[history]);

  React.useEffect(()=>{
    const ua=navigator.userAgent;
    const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    const standalone=window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
    try { if(ios&&!standalone&&!localStorage.getItem("cb-a2hs")) setA2hs(true); } catch {}
  },[]);

  const sameAsLast=()=>{
    if(!last){start();return;}
    setSetup({activity:last.activity,mode:last.requestedMode,duration:last.durationSeconds>=1500?30:last.durationSeconds>=900?20:10});
    queueMicrotask(start);
  };

  return <main className="app-frame screen-stack">
    <div className="topbar"><div className="wordmark">CARDIO<span>BRAIN</span></div><button className="action-secondary" style={{width:"auto",minHeight:44,padding:"0 12px",fontSize:10,letterSpacing:".12em"}} onClick={()=>navigate("settings")} aria-label="Open settings">SETTINGS</button></div>
    <section className="hero">
      <div className="hero-mark display-face" aria-hidden="true">CB</div>
      <div><div className="eyebrow">TRAIN IN MOTION</div><h1 className="hero-title display-face">Keep moving.<br/><em>Stay sharp.</em></h1><p className="hero-tag">Short cognitive challenges built for the space between breaths.</p></div>
      <div className="stat-row">
        <div className="stat"><div className="stat-value tabular">{last?Math.round(last.accuracy*100)+"%":"—"}</div><div className="stat-label">LAST ACCURACY</div></div>
        <div className="stat"><div className="stat-value tabular">{streak}<span style={{fontSize:13,color:"var(--activity)"}}> DAY</span></div><div className="stat-label">CURRENT STREAK</div></div>
        <div className="stat"><div className="stat-value tabular">{last?fmt(last.avgRt):"—"}</div><div className="stat-label">LAST AVG RT</div></div>
      </div>
      <div><button className="action-primary" onClick={()=>setScreen("setup")}>Start session</button>{last&&<button className="action-secondary" style={{width:"100%",marginTop:9}} onClick={sameAsLast}>Same as last time · {modeLabel(last.requestedMode)} · {last.activity.toUpperCase()}</button>}</div>
    </section>

    <AnimatePresence>
      {resumeAvailable&&active&&<motion.div className="panel" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
        <div className="eyebrow">SESSION STILL OPEN</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:8}}>
          <div><strong>{modeLabel(active.requestedMode)}</strong><div className="row-sub">{active.activity.toUpperCase()} · {durationLabel(currentElapsedSeconds(active))} in</div></div>
          <button className="action-primary" style={{width:"auto",minWidth:132,padding:"0 18px"}} onClick={resume}>Resume</button>
        </div>
        <button className="action-secondary" style={{width:"100%",marginTop:9}} onClick={()=>useCardioStore.getState().discardResume()}>Discard</button>
      </motion.div>}
    </AnimatePresence>

    {a2hs&&<div className="panel"><div className="eyebrow">MAKE IT ONE TAP</div><p className="body-copy">On iPhone: Share → Add to Home Screen. CardioBrain works offline after the first load.</p><button className="action-secondary" style={{width:"100%"}} onClick={()=>{try{localStorage.setItem("cb-a2hs","1")}catch{};setA2hs(false)}}>Got it</button></div>}
    {last&&<div className="panel"><div className="eyebrow">LAST SESSION</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:12,marginTop:10}}><div><strong>{last.activity.toUpperCase()} · {modeLabel(last.requestedMode)}</strong><div className="row-sub">{new Date(last.finishedAt).toLocaleDateString()} · {durationLabel(last.durationSeconds)}</div></div><div className="display-face" style={{fontSize:34,color:"var(--activity)"}}>{Math.round(last.accuracy*100)}%</div></div></div>}
    <BottomNav active="home" navigate={navigate}/>
  </main>;
}
