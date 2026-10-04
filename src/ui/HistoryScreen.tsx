import React from "react";
import type { ModeId, SessionResult } from "../engine/types";
import { MODE_REGISTRY } from "../modes/registry";
import { useCardioStore } from "../state/store";
import { BottomNav } from "./HomeScreen";

const modeLabel=(m:ModeId|"mix")=>m==="mix"?"Mix":MODE_REGISTRY[m].label;
const date=(ts:number)=>new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric"});
const duration=(s:number)=>s<60?Math.max(1,Math.round(s))+"s":Math.round(s/60)+"m";

function Sparkline({values}:{values:number[]}){
  if(values.length<2)return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none"><line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,.12)"/></svg>;
  const min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);
  const points=values.map((v,i)=>(i/(values.length-1))*100+","+(36-((v-min)/span)*28)).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--activity)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points}/></svg>;
}

export function HistoryScreen({navigate}:{navigate:(screen:"home"|"setup"|"history"|"settings")=>void}){
  const history=useCardioStore(s=>s.history);
  const [selected,setSelected]=React.useState<SessionResult|null>(null);
  const recent=history.slice(0,12);
  const accuracy=recent.slice(0,10).reverse().map(s=>s.accuracy*100);
  const response=recent.slice(0,10).reverse().map(s=>s.avgRt/1000);
  const daySet=new Set(history.map(s=>new Date(s.finishedAt).toISOString().slice(0,10)));
  const now=new Date();
  const calendar=Array.from({length:35},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()-(34-i));return d.toISOString().slice(0,10);});
  return <main className="app-frame screen-stack">
    <div className="topbar"><button className="icon-button" onClick={()=>navigate("home")} aria-label="Back">←</button><div className="eyebrow">HISTORY</div><div style={{width:44}}/></div>
    <div><h1 className="section-title">Proof<br/>of practice.</h1><p className="body-copy">Small sessions add up. The trend is the thing.</p></div>
    {history.length===0?<div className="panel empty-state"><div className="hero-mark" style={{margin:"0 auto 18px"}}>↗</div><strong>No sessions yet.</strong><p className="body-copy">Your first result becomes the baseline.</p></div>:<>
      <div className="panel history-chart"><div className="eyebrow">ACCURACY · LAST 10</div><div style={{fontSize:28,fontWeight:850,marginTop:5}}>{Math.round((recent[0]?.accuracy??0)*100)}%</div><Sparkline values={accuracy}/><div className="eyebrow" style={{marginTop:16}}>RESPONSE · LAST 10</div><div style={{fontSize:28,fontWeight:850,marginTop:5}}>{recent[0]?.avgRt?(recent[0].avgRt/1000).toFixed(2)+"s":"—"}</div><Sparkline values={response}/></div>
      <div className="panel"><div className="eyebrow" style={{marginBottom:12}}>CONSISTENCY · 5 WEEKS</div><div className="streak-grid">{calendar.map(day=><span key={day} className={"streak-cell "+(daySet.has(day)?"active":"")} title={day}/>)}</div></div>
      <div className="panel"><div className="eyebrow">SESSIONS</div><div className="history-list" style={{marginTop:4}}>{recent.map(session=>
        <button key={session.id} className="session-row" onClick={()=>setSelected(session)} style={{width:"100%",background:"transparent",color:"inherit",textAlign:"left",cursor:"pointer"}}>
          <div><div className="row-title">{session.activity.toUpperCase()} · {modeLabel(session.requestedMode)}</div><div className="row-sub">{date(session.finishedAt)} · {duration(session.durationSeconds)} · {session.challenges} challenges</div></div>
          <div className="display-face" style={{fontSize:28,color:"var(--activity)"}}>{Math.round(session.accuracy*100)}%</div>
        </button>
      )}</div></div>
    </>}
    {selected&&<div className="panel" style={{borderColor:"rgba(var(--activity-rgb),.28)"}}>
      <div className="topbar" style={{minHeight:24}}><div className="eyebrow">SESSION DETAIL</div><button className="icon-button" style={{width:34,height:34,borderRadius:10}} onClick={()=>setSelected(null)} aria-label="Close">×</button></div>
      <div style={{fontSize:32,fontWeight:850,letterSpacing:"-.05em",marginTop:10}}>{Math.round(selected.accuracy*100)}%</div>
      <div className="stat-row" style={{marginTop:12}}><div className="stat"><div className="stat-value">{duration(selected.durationSeconds)}</div><div className="stat-label">DURATION</div></div><div className="stat"><div className="stat-value">{selected.bestStreak}</div><div className="stat-label">BEST STREAK</div></div><div className="stat"><div className="stat-value">{selected.totalScore}</div><div className="stat-label">SCORE</div></div></div>
    </div>}
    <BottomNav active="history" navigate={navigate}/>
  </main>;
}
