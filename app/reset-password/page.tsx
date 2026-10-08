"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabaseClient";
export default function ResetPassword(){
 const [ready,setReady]=useState(false),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;const supabase=getBrowserSupabase();
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(active && session && (event==="PASSWORD_RECOVERY"||event==="SIGNED_IN"||event==="INITIAL_SESSION"))setReady(true)});
 supabase.auth.getSession().then(({data})=>{if(active&&data.session)setReady(true)});
 return ()=>{active=false;subscription.unsubscribe()};},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);const {error}=await getBrowserSupabase().auth.updateUser({password});setBusy(false);
 if(error)setMessage(error.message);else{setMessage("Password changed successfully. You can now sign in.");await getBrowserSupabase().auth.signOut();setReady(false);}}
 return <main className="shell"><section className="header"><h1>Choose a new password</h1></section><section className="card">{ready?<form onSubmit={submit} className="grid"><div className="field full"><label>New password</label><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="actions full"><button className="btn primary" disabled={busy}>Update password</button></div></form>:<p>Open the password reset link from your email. If the link has expired, request a new one.</p>}{message&&<p role="status">{message}</p>}<Link href="/login">Back to login</Link></section></main>;
}
