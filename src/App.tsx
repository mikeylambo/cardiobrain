import React from "react";
import { unlockAudio } from "./audio/synth";
import { useCardioStore } from "./state/store";
import { HomeScreen } from "./ui/HomeScreen";
import { SetupScreen } from "./ui/SetupScreen";
import { CountdownScreen } from "./ui/CountdownScreen";
import { SessionScreen } from "./ui/SessionScreen";
import { ResultsScreen } from "./ui/ResultsScreen";
import { HistoryScreen } from "./ui/HistoryScreen";
import { SettingsScreen } from "./ui/SettingsScreen";
import { OnboardingScreen } from "./ui/OnboardingScreen";
import { UpdateToast } from "./ui/UpdateToast";

export default function App(){
  const screen=useCardioStore(s=>s.screen);
  const hydrated=useCardioStore(s=>s.hydrated);
  const hydrate=useCardioStore(s=>s.hydrate);
  const onboardingDone=useCardioStore(s=>s.onboardingDone);
  const resumeAvailable=useCardioStore(s=>s.resumeAvailable);
  const setScreen=useCardioStore(s=>s.setScreen);
  const active=useCardioStore(s=>s.active);
  const setupActivity=useCardioStore(s=>s.setup.activity);

  React.useEffect(()=>{void hydrate();},[hydrate]);
  React.useEffect(()=>{
    if(hydrated&&screen==="home"&&!onboardingDone&&!resumeAvailable)setScreen("onboarding");
  },[hydrated,onboardingDone,resumeAvailable,screen,setScreen]);

  React.useEffect(()=>{document.body.dataset.activity=active?.activity??setupActivity;},[active?.activity,setupActivity]);

  React.useEffect(()=>{
    const unlock=()=>{void unlockAudio();};
    window.addEventListener("pointerdown",unlock,{once:true});
    return ()=>window.removeEventListener("pointerdown",unlock);
  },[]);

  if(!hydrated)return <main className="app-frame"><div className="countdown"><div className="eyebrow">LOADING</div></div></main>;

  const navigate=(destination:"home"|"setup"|"history"|"settings")=>setScreen(destination);
  return <>
    {screen==="onboarding"&&<OnboardingScreen/>}
    {screen==="home"&&<HomeScreen navigate={navigate}/>}
    {screen==="setup"&&<SetupScreen onBack={()=>setScreen("home")}/>}
    {screen==="countdown"&&<CountdownScreen/>}
    {screen==="session"&&<SessionScreen/>}
    {screen==="results"&&<ResultsScreen navigate={navigate}/>}
    {screen==="history"&&<HistoryScreen navigate={navigate}/>}
    {screen==="settings"&&<SettingsScreen navigate={navigate}/>}
    <UpdateToast/>
    <div style={{position:"fixed",width:1,height:1,overflow:"hidden",clipPath:"inset(50%)"}} aria-live="polite">
      {screen==="results"?"Session complete":screen==="session"?"Session in progress":""}
    </div>
  </>;
}
