"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({ name:"", email:"", password:"", supervisor:"" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function setField(k: keyof typeof form, v: string){ setForm(p=>({...p,[k]:v})); }

  async function submit(e: FormEvent){
    e.preventDefault(); setErr(""); setMsg("");
    const res = await fetch("/api/signup", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if(!res.ok){ setErr(data.error || "Sign up failed."); return; }
    setMsg("Account created. Please wait for administrator approval.");
  }

  return (
    <main className="shell">
      <section className="header">
        <p className="eyebrow">NEW USER</p>
        <h1>Create account</h1>
        <p className="subtitle">After registration, the administrator will approve your account and equipment permissions.</p>
      </section>
      <section className="card">
        <form onSubmit={submit} className="grid">
          <div className="field full"><label>Name</label><input required value={form.name} onChange={e=>setField("name",e.target.value)} /></div>
          <div className="field full"><label>Email</label><input required type="email" value={form.email} onChange={e=>setField("email",e.target.value)} /></div>
          <div className="field full"><label>Password</label><input required type="password" minLength={6} value={form.password} onChange={e=>setField("password",e.target.value)} /></div>
          <div className="field full"><label>Supervisor</label><input required value={form.supervisor} onChange={e=>setField("supervisor",e.target.value)} /></div>
          {err && <div className="error full">{err}</div>}
          {msg && <div className="success full">{msg}</div>}
          <div className="actions full"><Link className="btn" href="/login">Go to login</Link><button className="btn primary">Create account</button></div>
        </form>
      </section>
    </main>
  );
}
