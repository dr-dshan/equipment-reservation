"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseClient";
export default function ForgotPassword(){
 const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);
 const {error}=await getBrowserSupabase().auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});
 setBusy(false);setMessage(error?`Could not request reset: ${error.message}`:"If this email is registered, a password reset link will arrive shortly. Please check your spam folder too.");}
 return <main className="shell"><section className="header"><h1>Reset password</h1><p className="subtitle">Enter the email address used for your account.</p></section><section className="card"><form onSubmit={submit} className="grid"><div className="field full"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="actions full"><Link className="btn" href="/login">Back to login</Link><button className="btn primary" disabled={busy}>Send reset link</button></div></form>{message&&<p role="status">{message}</p>}</section></main>;
}
