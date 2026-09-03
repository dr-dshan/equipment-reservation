"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [err,setErr] = useState("");

  async function submit(e: FormEvent){
    e.preventDefault(); setErr("");
    const { error } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
    if(error){ setErr(error.message); return; }
    router.push("/");
  }

  return (
    <main className="shell">
      <section className="header">
        <p className="eyebrow">SIGN IN</p>
        <h1>Equipment Reservation</h1>
        <p className="subtitle">Sign in to request equipment reservations.</p>
      </section>
      <section className="card">
        <form onSubmit={submit} className="grid">
          <div className="field full"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field full"><label>Password</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
          {err && <div className="error full">{err}</div>}
          <div className="actions full"><Link className="btn" href="/signup">Create account</Link><button className="btn primary">Log in</button></div>
        </form>
      </section>
    </main>
  );
}
