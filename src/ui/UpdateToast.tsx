import React from "react";
import { registerSW } from "virtual:pwa-register";
import { useCardioStore } from "../state/store";

export function UpdateToast(){
  const screen=useCardioStore(s=>s.screen);
  const [ready,setReady]=React.useState(false);
  const update=React.useRef<(()=>Promise<void>|void)|null>(null);

  React.useEffect(()=>{
    update.current=registerSW({immediate:true,onNeedRefresh:()=>setReady(true)});
  },[]);

  if(!ready||screen!=="home")return null;
  return <div className="toast" role="status">
    <div><strong>Update ready</strong><div className="row-sub">Fresh improvements are waiting.</div></div>
    <button onClick={()=>{void update.current?.();setReady(false);}}>Update</button>
  </div>;
}
