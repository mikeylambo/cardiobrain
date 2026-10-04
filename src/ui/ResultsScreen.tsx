import { motion } from "framer-motion";
import React from "react";
import { sfx } from "../audio/synth";
import { MODE_REGISTRY } from "../modes/registry";
import { useCardioStore } from "../state/store";
import { BottomNav } from "./HomeScreen";
import type { SessionResult } from "../engine/types";

const modeName=(mode:SessionResult["requestedMode"])=>mode==="mix"?"Mix":MODE_REGISTRY[mode].label;
const time=(seconds:number)=>{const m=Math.floor(seconds/60),s=Math.round(seconds%60);return m?String(m)+"m "+String(s).padStart(2,"0")+"s":String(s)+"s";};
const headline=(r:SessionResult,p?:SessionResult)=>{if(r.bestStreak>=25)return "Locked in.";if(p&&r.accuracy>p.accuracy+.04)return "Sharper than last time.";if(r.avgRt>0&&r.avgRt<1000)return "Fast mind. Steady body.";if(r.accuracy>=.9)return "Clean work.";return "Good session. Keep moving.";};

async function shareResult(result:SessionResult){
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  const accent=result.activity==="walk"?"#5eead4":result.activity==="bike"?"#f5b84b":result.activity==="stairs"?"#af88ff":"#ff8b72";
  ctx.fillStyle="#05060A";ctx.fillRect(0,0,1080,1350);
  const glow=ctx.createRadialGradient(540,210,20,540,210,650);glow.addColorStop(0,accent+"30");glow.addColorStop(1,"#05060A00");ctx.fillStyle=glow;ctx.fillRect(0,0,1080,720);
  ctx.fillStyle="#8e95a7";ctx.font="700 32px Arial";ctx.fillText("CARDIOBRAIN",70,88);
  ctx.fillStyle="#f5f6fa";ctx.font="900 80px Arial";ctx.fillText(headline(result),70,205);
  ctx.fillStyle=accent;ctx.font="900 160px Arial";ctx.fillText(String(Math.round(result.accuracy*100))+"%",70,430);
  ctx.fillStyle="#f5f6fa";ctx.font="700 38px Arial";ctx.fillText("ACCURACY",74,480);
  const rows:[[string,string],[string,string],[string,string],[string,string]]=[[time(result.durationSeconds),"DURATION"],[String(result.challenges),"CHALLENGES"],[result.avgRt?(result.avgRt/1000).toFixed(2)+"s":"—","AVG RESPONSE"],[String(result.bestStreak),"BEST STREAK"]];
  rows.forEach(([value,label],i)=>{const y=610+i*145;ctx.fillStyle="#f5f6fa";ctx.font="800 58px Arial";ctx.fillText(value,70,y);ctx.fillStyle="#8e95a7";ctx.font="700 24px Arial";ctx.fillText(label,74,y+40);});
  ctx.fillStyle="#5d6474";ctx.font="600 24px Arial";ctx.fillText(result.activity.toUpperCase()+" · "+modeName(result.requestedMode),70,1260);
  await new Promise<void>(resolve=>canvas.toBlob(async blob=>{if(!blob){resolve();return;}const file=new File([blob],"cardiobrain-result.png",{type:"image/png"});try{const nav=navigator as Navigator & {canShare?:(data:ShareData)=>boolean};if(typeof nav.share==="function"&&typeof nav.canShare==="function"&&nav.canShare({files:[file]}))await nav.share({title:"CardioBrain session",text:"Train your body. Keep your mind sharp.",files:[file]});else{const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="cardiobrain-result.png";a.click();URL.revokeObjectURL(url);}}catch{}resolve();},"image/png"));
}

export function ResultsScreen({navigate}:{navigate:(screen:"home"|"setup"|"history"|"settings")=>void}){
  const result=useCardioStore(s=>s.lastResult);const history=useCardioStore(s=>s.history);const start=useCardioStore(s=>s.startCountdown);const prefs=useCardioStore(s=>s.prefs);if(!result)return null;
  const previous=history.find(item=>item.id!==result.id&&item.activity===result.activity&&item.requestedMode===result.requestedMode);
  const accuracyDelta=previous?result.accuracy-previous.accuracy:null;const rtDelta=previous?result.avgRt-previous.avgRt:null;const scoreDelta=previous?result.totalScore-previous.totalScore:null;
  return <main className="app-frame screen-stack"><div className="topbar"><div className="wordmark">CARDIO<span>BRAIN</span></div><div className="eyebrow">COMPLETE</div></div>
    <motion.section className="results-hero" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><div className="eyebrow">{result.activity.toUpperCase()} · {modeName(result.requestedMode)}</div><h1 className="section-title" style={{marginTop:8}}>{headline(result,previous)}</h1><div className="results-score display-face">{Math.round(result.accuracy*100)}<span style={{fontSize:30,color:"var(--activity)"}}>%</span></div><p className="body-copy">{previous?"Compared with your last matching session.":"First of its kind — this is your baseline."}</p></motion.section>
    <div className="metrics-grid"><Metric label="DURATION" value={time(result.durationSeconds)}/><Metric label="CHALLENGES" value={String(result.challenges)}/><Metric label="AVG RESPONSE" value={result.avgRt?(result.avgRt/1000).toFixed(2)+"s":"—"} delta={rtDelta!==null?(rtDelta<=0?"▼ ":"▲ ")+Math.abs(rtDelta/1000).toFixed(2)+"s":undefined} good={rtDelta!==null?rtDelta<=0:undefined}/><Metric label="BEST STREAK" value={String(result.bestStreak)}/></div>
    <div className="stat-row"><div className="stat"><div className="stat-value tabular">{result.totalScore}</div><div className="stat-label">TOTAL SCORE</div></div><div className="stat"><div className="stat-value tabular">{result.minLevel}–{result.maxLevel}</div><div className="stat-label">LEVEL RANGE</div></div><div className="stat"><div className="stat-value tabular">{scoreDelta===null?"—":(scoreDelta>=0?"+":"")+scoreDelta}</div><div className="stat-label">SCORE DELTA</div></div></div>
    <button className="action-primary" onClick={()=>{if(prefs.sound)sfx.done();start();}}>Go again</button><button className="action-secondary" onClick={()=>shareResult(result)}>Share result</button><button className="action-secondary" onClick={()=>navigate("history")}>View history</button><BottomNav active="home" navigate={navigate}/>
  </main>;
}
function Metric({label,value,delta,good}:{label:string;value:string;delta?:string;good?:boolean}){return <div className="metric-card"><div className="metric-value">{value}</div><div className="metric-label">{label}</div>{delta&&<div className={good?"delta-up":"delta-down"} style={{fontSize:10,marginTop:6}}>{delta}</div>}</div>;}
