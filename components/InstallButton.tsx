"use client";
import { useEffect, useState } from "react";
type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}> };
export default function InstallButton(){
  const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
  const [ios,setIos]=useState(false);
  const [installed,setInstalled]=useState(false);
  useEffect(()=>{
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone===true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h=(e:Event)=>{e.preventDefault();setInstallPrompt(e as InstallPrompt)};
    window.addEventListener("beforeinstallprompt",h);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  if(installed) return null;
  if(installPrompt) return <button className="pill" onClick={async()=>{await installPrompt.prompt();const c=await installPrompt.userChoice;if(c.outcome==="accepted")setInstalled(true);setInstallPrompt(null)}}>Install app</button>;
  if(ios) return <span className="pill">iPhone: Share → Add to Home Screen</span>;
  return null;
}
