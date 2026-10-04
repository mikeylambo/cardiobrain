import { motion } from "framer-motion";
import React from "react";
import { sfx, unlockAudio } from "../audio/synth";
import { haptics } from "../haptics";
import { requestWakeLock } from "../wakelock";
import { useCardioStore } from "../state/store";

export function CountdownScreen() {
  const finish=useCardioStore(s=>s.finishCountdown);
  const prefs=useCardioStore(s=>s.prefs);
  const [count,setCount]=React.useState(3);

  React.useEffect(()=>{
    void requestWakeLock();
    let current=3;
    const id=window.setInterval(()=>{
      setCount(current);
      current-=1;
      if(current<0) window.clearInterval(id);
    },760);
    setCount(3);
    return ()=>window.clearInterval(id);
  },[]);

  React.useEffect(()=>{
    void unlockAudio();
    if(count>=1){
      if(prefs.sound)sfx.countdown(count);
      if(prefs.haptics)haptics.countdown(count===1);
    }
    if(count===0){
      const id=window.setTimeout(finish,220);
      return ()=>window.clearTimeout(id);
    }
  },[count,finish,prefs.haptics,prefs.sound]);

  return <main className="app-frame running-frame"><div className="countdown">
    <motion.div key={count} initial={{opacity:0,scale:.68}} animate={{opacity:1,scale:1}} className="countdown-number">{count===0?"GO":count}</motion.div>
  </div></main>;
}
