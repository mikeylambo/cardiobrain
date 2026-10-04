import React from "react";
import { useCardioStore } from "../state/store";
import { exportData } from "../storage";
import { BottomNav } from "./HomeScreen";

export function SettingsScreen({navigate}:{navigate:(screen:"home"|"setup"|"history"|"settings")=>void}){
  const prefs=useCardioStore(s=>s.prefs);
  const update=useCardioStore(s=>s.updatePrefs);
  const history=useCardioStore(s=>s.history);
  const progress=useCardioStore(s=>s.progress);
  const reset=useCardioStore(s=>s.resetData);
  const [confirm,setConfirm]=React.useState(false);
  return <main className="app-frame screen-stack">
    <div className="topbar"><button className="icon-button" onClick={()=>navigate("home")} aria-label="Back">←</button><div className="eyebrow">SETTINGS</div><div style={{width:44}}/></div>
    <div><h1 className="section-title">Tune the<br/>experience.</h1><p className="body-copy">Everything stays on this device.</p></div>
    <div className="panel"><div className="eyebrow">FEEDBACK</div>
      <Toggle label="Sound" copy="Synthesized cues and rule tones." value={prefs.sound} onChange={v=>update({sound:v})}/>
      <Toggle label="Haptics" copy="Brief tactile cues when supported." value={prefs.haptics} onChange={v=>update({haptics:v})}/>
      <Toggle label="Reduced motion" copy="Keep the hierarchy, remove flourish." value={prefs.reducedMotion} onChange={v=>update({reducedMotion:v})}/>
    </div>
    <div className="panel"><div className="eyebrow">DIFFICULTY BIAS</div><div className="duration-row" style={{marginTop:12}}>{(["gentle","standard","hard"] as const).map(v=><button key={v} className={"chip "+(prefs.difficultyBias===v?"selected":"")} onClick={()=>update({difficultyBias:v})}>{v.toUpperCase()}</button>)}</div><p className="body-copy" style={{marginBottom:0,marginTop:10}}>Bias changes timing and score weight; your learned level stays yours.</p></div>
    <div className="panel"><div className="eyebrow">YOUR DATA</div>
      <div className="setting-row"><div><strong>{history.length}</strong><div className="row-sub">stored sessions</div></div><button className="action-secondary" style={{minHeight:44,padding:"0 14px"}} onClick={()=>exportData(history,progress,prefs)}>Export JSON</button></div>
      <div className="setting-row"><div><strong>Local only</strong><div className="row-sub">No account or server database.</div></div><span style={{color:"var(--activity)"}}>✓</span></div>
      <div className="setting-row"><div><strong>Reset everything</strong><div className="row-sub">History, active session, and difficulty.</div></div><button className="action-secondary" style={{minHeight:44,padding:"0 14px"}} onClick={()=>setConfirm(true)}>Reset</button></div>
    </div>
    {confirm&&<div className="panel"><strong>Clear all CardioBrain data?</strong><p className="body-copy">This cannot be undone.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button className="action-secondary" onClick={()=>setConfirm(false)}>Cancel</button><button className="action-primary" onClick={async()=>{await reset();setConfirm(false)}}>Clear data</button></div></div>}
    <div className="tap-note" style={{textAlign:"center"}}>CARDIOBRAIN 1.0 · OFFLINE-FIRST</div>
    <BottomNav active="settings" navigate={navigate}/>
  </main>;
}
function Toggle({label,copy,value,onChange}:{label:string;copy:string;value:boolean;onChange:(value:boolean)=>void}){
  return <div className="setting-row"><div><strong>{label}</strong><div className="row-sub">{copy}</div></div><button className={"toggle "+(value?"on":"")} onClick={()=>onChange(!value)} role="switch" aria-checked={value} aria-label={label}><i/></button></div>;
}
