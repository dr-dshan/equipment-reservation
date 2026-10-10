"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase, getValidSession } from "@/lib/supabaseClient";
import { EQUIPMENT } from "@/lib/equipment";
import Nav from "@/components/Nav";

type UserRow = { id:string; email:string; name:string; supervisor:string; status:string; permissions:string[] };
type Reservation = { id:string; equipment:string; name:string; email:string; supervisor:string; purpose:string; start_time:string; end_time:string; status:string };
type Block = {id:string;equipment:string;title:string;reason:string;start_time:string;end_time:string};
const emptyBlock:{id:string;equipment:string;title:string;reason:string;start:string;end:string}={id:"",equipment:EQUIPMENT[0],title:"Maintenance",reason:"",start:"",end:""};

export default function AdminPage(){
  const router=useRouter();
  const [token,setToken]=useState("");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [blocks,setBlocks]=useState<Block[]>([]);
  const [blockForm,setBlockForm]=useState({...emptyBlock});
  const [err,setErr]=useState("");
  const [msg,setMsg]=useState("");

  async function load(t=token){
    const u=await fetch("/api/admin/users",{headers:{Authorization:`Bearer ${t}`}});
    if(!u.ok){ router.push("/"); return; }
    const uj=await u.json(); setUsers(uj.users||[]);
    const r=await fetch("/api/admin/reservations",{headers:{Authorization:`Bearer ${t}`}});
    const rj=await r.json(); setReservations(rj.reservations||[]);
    const m=await fetch("/api/admin/maintenance",{headers:{Authorization:`Bearer ${t}`}});
    const mj=await m.json(); if(m.ok)setBlocks(mj.blocks||[]);
  }

  useEffect(()=>{(async()=>{const session=await getValidSession(); const t=session?.access_token; if(!t){router.replace("/login"); return;} setToken(t); await load(t);})();},[]);

  async function updateUser(user:UserRow, patch:any){
    setErr(""); setMsg("");
    const res=await fetch(`/api/admin/users/${user.id}`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(patch)});
    const out=await res.json();
    if(!res.ok){setErr(out.error||"Update failed.");return;}
    setMsg("Saved."); await load();
  }

  async function togglePerm(user:UserRow,equipment:string,checked:boolean){
    setErr(""); setMsg("");

    // Update the checkbox immediately. Do not reload the entire user list.
    setUsers(prev=>prev.map(u=>u.id===user.id
      ? {...u,permissions:checked
          ? Array.from(new Set([...u.permissions,equipment]))
          : u.permissions.filter(p=>p!==equipment)}
      : u));

    try {
      const res=await fetch(`/api/admin/users/${user.id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({permission:{equipment,allowed:checked}})
      });
      const out=await res.json().catch(()=>({}));

      if(!res.ok){
        // Revert only this checkbox if saving fails.
        setUsers(prev=>prev.map(u=>u.id===user.id
          ? {...u,permissions:checked
              ? u.permissions.filter(p=>p!==equipment)
              : Array.from(new Set([...u.permissions,equipment]))}
          : u));
        setErr(out.error||"Permission update failed.");
        return;
      }

      // No full reload here: the optimistic local state is already correct.
      setMsg(`${equipment}: ${checked ? "Access granted" : "Access removed"}`);
    } catch {
      // Network failure: revert only this checkbox.
      setUsers(prev=>prev.map(u=>u.id===user.id
        ? {...u,permissions:checked
            ? u.permissions.filter(p=>p!==equipment)
            : Array.from(new Set([...u.permissions,equipment]))}
        : u));
      setErr("Network error while saving permission.");
    }
  }
  async function reviewReservation(id:string,action:"approve"|"decline"){
    setErr(""); setMsg("");
    // Immediate local feedback.
    const nextStatus=action==="approve"?"approved":"declined";
    const previous=reservations.find(r=>r.id===id)?.status;
    setReservations(prev=>prev.map(r=>r.id===id?{...r,status:nextStatus}:r));
    try{
      const res=await fetch("/api/admin/reservations",{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({id,action})
      });
      const out=await res.json().catch(()=>({}));
      if(!res.ok){
        if(previous) setReservations(prev=>prev.map(r=>r.id===id?{...r,status:previous}:r));
        setErr(out.error||"Could not update reservation.");
        return;
      }
      setMsg(`Reservation ${out.status}.`);
    }catch{
      if(previous) setReservations(prev=>prev.map(r=>r.id===id?{...r,status:previous}:r));
      setErr("Network error while updating reservation.");
    }
  }
  async function resetPassword(user:UserRow){
    setErr("");setMsg("");const res=await fetch(`/api/admin/users/${user.id}`,{method:"POST",headers:{Authorization:`Bearer ${token}`}});
    const out=await res.json().catch(()=>({}));if(!res.ok){setErr(out.error||"Could not send reset email.");return;}
    setMsg(`Password reset email sent to ${user.email}.`);
  }
  async function deleteUser(user:UserRow){
    if(!window.confirm(`Permanently delete ${user.name} (${user.email})? This cannot be undone.`))return;
    setErr("");setMsg("");const res=await fetch(`/api/admin/users/${user.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
    const out=await res.json().catch(()=>({}));if(!res.ok){setErr(out.error||"Could not delete user.");return;}
    setUsers(prev=>prev.filter(u=>u.id!==user.id));setMsg("User account deleted. They may sign up again.");
  }

  function localInput(iso:string){const d=new Date(iso);const p=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
  async function saveBlock(e:FormEvent){
    e.preventDefault();setErr("");setMsg("");
    const method=blockForm.id?"PATCH":"POST";
    const res=await fetch("/api/admin/maintenance",{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({...blockForm,start:new Date(blockForm.start).toISOString(),end:new Date(blockForm.end).toISOString()})});
    const out=await res.json();if(!res.ok){setErr(out.error||"Could not save block.");return}setBlockForm({...emptyBlock});setMsg("Maintenance block saved.");await load();
  }
  function editBlock(b:Block){setBlockForm({id:b.id,equipment:b.equipment,title:b.title,reason:b.reason||"",start:localInput(b.start_time),end:localInput(b.end_time)});window.scrollTo({top:0,behavior:"smooth"})}
  async function deleteBlock(b:Block){if(!window.confirm(`Delete ${b.title}?`))return;const res=await fetch(`/api/admin/maintenance?id=${encodeURIComponent(b.id)}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});const out=await res.json();if(!res.ok){setErr(out.error||"Could not delete block.");return}setBlocks(x=>x.filter(v=>v.id!==b.id));setMsg("Maintenance block deleted.")}


  return (
    <main className="shell">
      <section className="header"><Nav isAdmin/><p className="eyebrow">ADMIN</p><h1>Admin Dashboard</h1><p className="subtitle">Approve users, manage equipment permissions, and block equipment time for maintenance.</p></section>
      {err && <section className="card error">{err}</section>}{msg && <section className="card success">{msg}</section>}
      <section className="card"><h2>Maintenance / Block Time</h2>
        <form className="grid" onSubmit={saveBlock}>
          <div className="field"><label>Equipment</label><select value={blockForm.equipment} onChange={e=>setBlockForm(f=>({...f,equipment:e.target.value}))}>{EQUIPMENT.map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Title</label><input required value={blockForm.title} onChange={e=>setBlockForm(f=>({...f,title:e.target.value}))}/></div>
          <div className="field"><label>Start</label><input type="datetime-local" required value={blockForm.start} onChange={e=>setBlockForm(f=>({...f,start:e.target.value}))}/></div>
          <div className="field"><label>End</label><input type="datetime-local" required value={blockForm.end} onChange={e=>setBlockForm(f=>({...f,end:e.target.value}))}/></div>
          <div className="field full"><label>Reason / Notes</label><textarea value={blockForm.reason} onChange={e=>setBlockForm(f=>({...f,reason:e.target.value}))}/></div>
          <div className="actions full">{blockForm.id&&<button type="button" className="btn" onClick={()=>setBlockForm({...emptyBlock})}>Cancel Edit</button>}<button className="btn primary">{blockForm.id?"Update Block":"Create Block"}</button></div>
        </form>
        <table className="table"><thead><tr><th>Equipment</th><th>Title</th><th>Time</th><th>Reason</th><th>Action</th></tr></thead><tbody>
          {blocks.map(b=><tr key={b.id}><td>{b.equipment}</td><td>{b.title}</td><td>{new Date(b.start_time).toLocaleString()}<br/>– {new Date(b.end_time).toLocaleString()}</td><td>{b.reason||"—"}</td><td><button className="btn" onClick={()=>editBlock(b)}>Edit</button> <button className="btn red" onClick={()=>deleteBlock(b)}>Delete</button></td></tr>)}
          {!blocks.length&&<tr><td colSpan={5}>No maintenance blocks.</td></tr>}
        </tbody></table>
      </section>
      <section className="card"><h2>Pending Users</h2>
        <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Supervisor</th><th>Action</th></tr></thead><tbody>
          {users.filter(u=>u.status==="pending").map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.supervisor}</td><td><button className="btn primary" onClick={()=>updateUser(u,{status:"approved"})}>Approve</button> <button className="btn red" onClick={()=>updateUser(u,{status:"rejected"})}>Reject</button> <button className="btn" onClick={()=>resetPassword(u)}>Reset Password</button> <button className="btn red" onClick={()=>deleteUser(u)}>Delete User</button></td></tr>)}
          {users.filter(u=>u.status==="pending").length===0 && <tr><td colSpan={4}>No pending users.</td></tr>}
        </tbody></table>
      </section>

      <section className="card"><h2>User Permissions</h2>
        <table className="table"><thead><tr><th>User</th><th>Status</th><th>Permissions</th><th>Status Change</th></tr></thead><tbody>
          {users.map(u=><tr key={u.id}><td><b>{u.name}</b><br/>{u.email}<br/>Supervisor: {u.supervisor}</td><td>{u.status}</td><td><div className="checks">{EQUIPMENT.map(e=><label className="check" key={e}><input type="checkbox" checked={u.permissions.includes(e)} onChange={ev=>togglePerm(u,e,ev.target.checked)}/>{e}</label>)}</div></td><td><button className="btn" onClick={()=>updateUser(u,{status:"approved"})}>Approve</button> <button className="btn red" onClick={()=>updateUser(u,{status:"rejected"})}>Reject</button> <button className="btn" onClick={()=>resetPassword(u)}>Reset Password</button> <button className="btn red" onClick={()=>deleteUser(u)}>Delete User</button></td></tr>)}
        </tbody></table>
      </section>

      <section className="card"><h2>Recent Reservations</h2>
        <table className="table"><thead><tr><th>Equipment</th><th>User</th><th>Time</th><th>Status</th><th>Purpose</th><th>Action</th></tr></thead><tbody>
          {reservations.map(r=><tr key={r.id}><td>{r.equipment}</td><td>{r.name}<br/>{r.email}</td><td>{new Date(r.start_time).toLocaleString()}<br/>– {new Date(r.end_time).toLocaleString()}</td><td>{r.status}</td><td>{r.purpose}</td><td>{r.status==="pending"?<><button className="btn" onClick={()=>reviewReservation(r.id,"approve")}>Approve</button> <button className="btn red" onClick={()=>reviewReservation(r.id,"decline")}>Decline</button></>:"—"}</td></tr>)}
        </tbody></table>
      </section>
    </main>
  );
}
