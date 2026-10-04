import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";
import { sfx } from "../audio/synth";
import { haptics } from "../haptics";
import { requestWakeLock, releaseWakeLock } from "../wakelock";
import { MODE_REGISTRY } from "../modes/registry";
import { currentElapsedSeconds, useCardioStore } from "../state/store";
import { saveActiveSession } from "../storage";

const fmt=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(Math.floor(seconds%60)).padStart(2,"0")}`;

export function SessionScreen(){
  const active=useCardioStore(s=>s.active);
  const prefs=useCardioStore(s=>s.prefs);
  const pause=useCardioStore(s=>s.pauseSession);
  const answer=useCardioStore(s=>s.answer);
  const present=useCardioStore(s=>s.presentChallenge);
  const finish=useCardioStore(s=>s.finishSession);
  const reduced=useReducedMotion()||prefs.reducedMotion;
  const [elapsed,setElapsed]=React.useState(()=>currentElapsedSeconds(active));
  const [feedback,setFeedback]=React.useState<"correct"|"wrong"|"milestone"|null>(null);
  const [ending,setEnding]=React.useState(false);
  const endTimer=React.useRef<number|null>(null);
  const hiddenAt=React.useRef<number|null>(null);

  React.useEffect(()=>{
    const id=window.setInterval(()=>{
      const latest=useCardioStore.getState().active;
      setElapsed(currentElapsedSeconds(latest));
    },250);
    return ()=>window.clearInterval(id);
  },[]);

  React.useEffect(()=>{
    if(active?.durationSeconds!==null&&active?.status==="running"&&elapsed>=active.durationSeconds) finish();
  },[active,elapsed,finish]);

  React.useEffect(()=>{
    void requestWakeLock();
    return ()=>{void releaseWakeLock();};
  },[]);

  React.useEffect(()=>{
    const onVisibility=()=>{
      if(document.visibilityState==="hidden"){hiddenAt.current=performance.now();return;}
      if(hiddenAt.current!==null&&performance.now()-hiddenAt.current>3000&&useCardioStore.getState().active?.status==="running") pause();
      hiddenAt.current=null;
      if(document.visibilityState==="visible"&&useCardioStore.getState().active?.status==="running") void requestWakeLock();
    };
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>document.removeEventListener("visibilitychange",onVisibility);
  },[pause]);

  React.useEffect(()=>()=>{if(endTimer.current!==null)window.clearTimeout(endTimer.current);},[]);

  React.useEffect(()=>{
    const id=window.setInterval(()=>{
      const latest=useCardioStore.getState().active;
      if(latest&&latest.status==="running") void saveActiveSession(latest);
    },5000);
    return ()=>window.clearInterval(id);
  },[]);

  React.useEffect(()=>{
    if(!active||active.status!=="running"||active.currentMode==="recall")return;
    const frame=requestAnimationFrame(()=>present());
    return ()=>cancelAnimationFrame(frame);
  },[active?.currentChallenge.id,active?.status,active?.currentMode,present]);

  if(!active)return null;

  if(active.status==="paused") return <main className="app-frame running-frame"><div className="pause-overlay"><div>
    <div className="eyebrow">PAUSED</div><div className="pause-title">Catch your breath.</div>
    <p className="body-copy" style={{margin:"14px auto 24px",maxWidth:290}}>Resume when the next challenge can get your full attention.</p>
    <button className="action-primary" onClick={()=>useCardioStore.getState().resumeCountdown()}>Resume</button>
    <button className="action-secondary" style={{width:"100%",marginTop:9}} onClick={()=>setEnding(true)}>End session</button>
    {ending&&<div className="panel" style={{marginTop:14,textAlign:"left"}}><div className="eyebrow">END SESSION?</div><p className="body-copy">This session will be saved with the results you have so far.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button className="action-secondary" onClick={()=>setEnding(false)}>Cancel</button><button className="action-primary" onClick={finish}>End & save</button></div></div>}
  </div></div></main>;

  const mode=MODE_REGISTRY[active.currentMode];
  const ModeView=mode.View;
  const onPresented=React.useCallback(()=>present(),[present]);

  const onAnswer=React.useCallback((answerId:string)=>{
    const current=useCardioStore.getState().active;
    if(!current)return;
    const correct=answerId===current.currentChallenge.correctAnswer;
    const nextStreak=correct?current.streak+1:0;
    const milestone=nextStreak===5||nextStreak===10||nextStreak===25;
    if(prefs.sound) milestone?sfx.milestone():correct?sfx.correct():sfx.wrong();
    if(prefs.haptics) milestone?haptics.milestone():correct?haptics.correct():haptics.wrong();
    setFeedback(milestone?"milestone":correct?"correct":"wrong");
    window.setTimeout(()=>setFeedback(null),260);
    answer(answerId);
  },[answer,prefs.haptics,prefs.sound]);

  return <main className="app-frame running-frame">
    <div className="session-top"><div><div className="eyebrow">{active.currentMode.toUpperCase()}</div></div><div className="center tabular" style={{fontSize:12,color:"var(--muted)"}}>{fmt(elapsed)}</div>
      <div className="right"><button className="pause-button" aria-label="Pause session. Hold to end." onClick={pause}
        onPointerDown={()=>{endTimer.current=window.setTimeout(()=>setEnding(true),900);}}
        onPointerUp={()=>{if(endTimer.current!==null)window.clearTimeout(endTimer.current);}}
        onPointerCancel={()=>{if(endTimer.current!==null)window.clearTimeout(endTimer.current);}}
        onPointerLeave={()=>{if(endTimer.current!==null)window.clearTimeout(endTimer.current);}}>Ⅱ</button></div>
    </div>
    <div className="session-body"><AnimatePresence mode="wait"><motion.div key={active.currentChallenge.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?.05:.16}} style={{display:"flex",flex:1,minHeight:0}}>
      <ModeView challenge={active.currentChallenge} onAnswer={onAnswer} onPresented={onPresented}/>
    </motion.div></AnimatePresence></div>
    <div className="tap-note" style={{textAlign:"center",padding:"0 0 4px"}}>STREAK {active.streak} · LEVEL {active.currentChallenge.level}</div>
    <AnimatePresence>{feedback&&<motion.div initial={{opacity:0,scale:.84}} animate={{opacity:1,scale:1}} exit={{opacity:0}} style={{position:"fixed",inset:0,display:"grid",placeItems:"center",pointerEvents:"none",zIndex:8}}>
      <div style={{width:90,height:90,borderRadius:"50%",background:"var(--activity-soft)",border:"1px solid rgba(var(--activity-rgb),.3)",display:"grid",placeItems:"center",color:"var(--activity)",fontSize:28,fontWeight:900,boxShadow:"0 0 70px rgba(var(--activity-rgb),.18)"}}>{feedback==="correct"?"✓":feedback==="milestone"?"✦":"·"}</div>
    </motion.div>}</AnimatePresence>
  </main>;
}
