"use client";
import { FormEvent, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseClient";

export default function BookingModal({ me, equipment, initialStart, onClose, onSubmitted }:{
  me:{name:string; email:string; supervisor:string};
  equipment:string; initialStart:string; onClose:()=>void; onSubmitted:()=>void;
}) {
  const date = initialStart.slice(0,10);
  const time = initialStart.length>=16 ? initialStart.slice(11,16) : "09:00";
  const endDefault = useMemo(()=>{ const [h,m]=time.split(":").map(Number); return `${String(Math.min(h+1,23)).padStart(2,"0")}:${String(m).padStart(2,"0")}`; },[time]);
  const [form,setForm] = useState({ date, startTime:time, endTime:endDefault, purpose:"", notes:"" });
  const [err,setErr] = useState(""); const [sub,setSub] = useState(false);
  function setField(k:keyof typeof form,v:string){ setForm(p=>({...p,[k]:v})); }
  async function submit(e:FormEvent){
    e.preventDefault(); setErr(""); setSub(true);
    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);
    if(!(end>start)){ setErr("End time must be later than start time."); setSub(false); return; }
    const { data } = await getBrowserSupabase().auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/reservations", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body:JSON.stringify({ equipment, start:start.toISOString(), end:end.toISOString(), purpose:form.purpose, notes:form.notes })
    });
    const out = await res.json();
    setSub(false);
    if(!res.ok){ setErr(out.error || "Could not submit reservation."); return; }
    onSubmitted();
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">RESERVATION REQUEST</p><h2>{equipment}</h2></div><button className="close" onClick={onClose}>×</button></div>
        <p className="subtitle">User: {me.name} / Supervisor: {me.supervisor}</p>
        <form onSubmit={submit} className="grid">
          <div className="field"><label>Date</label><input type="date" required value={form.date} onChange={e=>setField("date",e.target.value)}/></div>
          <div className="field"><label>Start time</label><input type="time" required value={form.startTime} onChange={e=>setField("startTime",e.target.value)}/></div>
          <div className="field"><label>End time</label><input type="time" required value={form.endTime} onChange={e=>setField("endTime",e.target.value)}/></div>
          <div className="field full"><label>Purpose</label><textarea required value={form.purpose} onChange={e=>setField("purpose",e.target.value)}/></div>
          <div className="field full"><label>Notes</label><textarea value={form.notes} onChange={e=>setField("notes",e.target.value)}/></div>
          {err && <div className="error full">{err}</div>}
          <div className="actions full"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={sub}>{sub?"Submitting...":"Request Reservation"}</button></div>
        </form>
      </div>
    </div>
  );
}
