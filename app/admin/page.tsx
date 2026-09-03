"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { EQUIPMENT } from "@/lib/equipment";
import Nav from "@/components/Nav";

type UserRow = { id:string; email:string; name:string; supervisor:string; status:string; permissions:string[] };
type Reservation = { id:string; equipment:string; name:string; email:string; supervisor:string; purpose:string; start_time:string; end_time:string; status:string };

export default function AdminPage(){
  const router=useRouter();
  const [token,setToken]=useState("");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [err,setErr]=useState("");
  const [msg,setMsg]=useState("");

  async function load(t=token){
    const u=await fetch("/api/admin/users",{headers:{Authorization:`Bearer ${t}`}});
    if(!u.ok){ router.push("/"); return; }
    const uj=await u.json(); setUsers(uj.users||[]);
    const r=await fetch("/api/admin/reservations",{headers:{Authorization:`Bearer ${t}`}});
    const rj=await r.json(); setReservations(rj.reservations||[]);
  }

  useEffect(()=>{(async()=>{const {data}=await getBrowserSupabase().auth.getSession(); const t=data.session?.access_token; if(!t){router.push("/login"); return;} setToken(t); await load(t);})();},[]);

  async function updateUser(user:UserRow, patch:any){
    setErr(""); setMsg("");
    const res=await fetch(`/api/admin/users/${user.id}`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(patch)});
    const out=await res.json();
    if(!res.ok){setErr(out.error||"Update failed.");return;}
    setMsg("Saved."); await load();
  }

  function togglePerm(user:UserRow,equipment:string,checked:boolean){
    const permissions = checked ? Array.from(new Set([...user.permissions,equipment])) : user.permissions.filter(p=>p!==equipment);
    updateUser(user,{permissions});
  }

  return (
    <main className="shell">
      <section className="header"><Nav isAdmin/><p className="eyebrow">ADMIN</p><h1>Admin Dashboard</h1><p className="subtitle">Approve users and manage equipment permissions.</p></section>
      {err && <section className="card error">{err}</section>}{msg && <section className="card success">{msg}</section>}
      <section className="card"><h2>Pending Users</h2>
        <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Supervisor</th><th>Action</th></tr></thead><tbody>
          {users.filter(u=>u.status==="pending").map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.supervisor}</td><td><button className="btn primary" onClick={()=>updateUser(u,{status:"approved"})}>Approve</button> <button className="btn red" onClick={()=>updateUser(u,{status:"rejected"})}>Reject</button></td></tr>)}
          {users.filter(u=>u.status==="pending").length===0 && <tr><td colSpan={4}>No pending users.</td></tr>}
        </tbody></table>
      </section>

      <section className="card"><h2>User Permissions</h2>
        <table className="table"><thead><tr><th>User</th><th>Status</th><th>Permissions</th><th>Status Change</th></tr></thead><tbody>
          {users.map(u=><tr key={u.id}><td><b>{u.name}</b><br/>{u.email}<br/>Supervisor: {u.supervisor}</td><td>{u.status}</td><td><div className="checks">{EQUIPMENT.map(e=><label className="check" key={e}><input type="checkbox" checked={u.permissions.includes(e)} onChange={ev=>togglePerm(u,e,ev.target.checked)}/>{e}</label>)}</div></td><td><button className="btn" onClick={()=>updateUser(u,{status:"approved"})}>Approve</button> <button className="btn red" onClick={()=>updateUser(u,{status:"rejected"})}>Reject</button></td></tr>)}
        </tbody></table>
      </section>

      <section className="card"><h2>Recent Reservations</h2>
        <table className="table"><thead><tr><th>Equipment</th><th>User</th><th>Time</th><th>Status</th><th>Purpose</th></tr></thead><tbody>
          {reservations.map(r=><tr key={r.id}><td>{r.equipment}</td><td>{r.name}<br/>{r.email}</td><td>{new Date(r.start_time).toLocaleString()}<br/>– {new Date(r.end_time).toLocaleString()}</td><td>{r.status}</td><td>{r.purpose}</td></tr>)}
        </tbody></table>
      </section>
    </main>
  );
}
