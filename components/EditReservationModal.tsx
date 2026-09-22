"use client";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseClient";

type Reservation={id:string;equipment:string;start:string;end:string;status:string;purpose?:string;notes?:string};

function localParts(iso:string){
  const d=new Date(iso);
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return {date:`${y}-${m}-${day}`,time:`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
}

export default function EditReservationModal({reservation,onClose,onChanged}:{
  reservation:Reservation;onClose:()=>void;onChanged:(message:string)=>void;
}){
  const a=localParts(reservation.start), b=localParts(reservation.end);
  const [form,setForm]=useState({date:a.date,startTime:a.time,endTime:b.time,purpose:reservation.purpose||"",notes:reservation.notes||""});
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const field=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  async function auth(){const {data}=await getBrowserSupabase().auth.getSession();return data.session?.access_token}
  async function save(e:FormEvent){
    e.preventDefault();setErr("");setBusy(true);
    const start=new Date(`${form.date}T${form.startTime}:00`),end=new Date(`${form.date}T${form.endTime}:00`);
    if(!(end>start)){setErr("End time must be later than start time.");setBusy(false);return}
    const token=await auth();
    const res=await fetch("/api/reservations",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({id:reservation.id,start:start.toISOString(),end:end.toISOString(),purpose:form.purpose,notes:form.notes})});
    const out=await res.json();setBusy(false);
    if(!res.ok){setErr(out.error||"Could not update reservation.");return}
    onChanged(out.needsApproval
      ?"Reservation updated. Because the reserved time was extended, administrator approval is required again."
      :"Reservation updated. The approved time was only reduced, so no new approval is required.");
  }
  async function cancel(){
    if(!window.confirm("Cancel this reservation? Administrator approval is not required.")) return;
    setErr("");setBusy(true);const token=await auth();
    const res=await fetch(`/api/reservations?id=${encodeURIComponent(reservation.id)}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
    const out=await res.json();setBusy(false);
    if(!res.ok){setErr(out.error||"Could not cancel reservation.");return}
    onChanged("Reservation cancelled.");
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><p className="eyebrow">MY RESERVATION</p><h2>{reservation.equipment}</h2></div><button className="close" onClick={onClose}>×</button></div>
    <p className="subtitle">Status: {reservation.status}. Reducing an approved time does not require reapproval; extending it does.</p>
    <form onSubmit={save} className="grid">
      <div className="field"><label>Date</label><input type="date" required value={form.date} onChange={e=>field("date",e.target.value)}/></div>
      <div className="field"><label>Start time</label><input type="time" required value={form.startTime} onChange={e=>field("startTime",e.target.value)}/></div>
      <div className="field"><label>End time</label><input type="time" required value={form.endTime} onChange={e=>field("endTime",e.target.value)}/></div>
      <div className="field full"><label>Purpose</label><textarea required value={form.purpose} onChange={e=>field("purpose",e.target.value)}/></div>
      <div className="field full"><label>Notes</label><textarea value={form.notes} onChange={e=>field("notes",e.target.value)}/></div>
      {err&&<div className="error full">{err}</div>}
      <div className="actions full">
        <button type="button" className="btn red" disabled={busy} onClick={cancel}>Cancel Reservation</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" disabled={busy}>{busy?"Saving...":"Save Changes"}</button>
      </div>
    </form>
  </div></div>
}