"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { EQUIPMENT, EquipmentName } from "@/lib/equipment";
import BookingModal from "./BookingModal";
import Nav from "./Nav";

type Me = { id:string; email:string; name:string; supervisor:string; status:string; isAdmin:boolean; permissions:string[] };
type Event = { id:string; title:string; start:string; end:string; status:"pending"|"approved" };

export default function BookingCalendar(){
  const router = useRouter();
  const [me,setMe] = useState<Me|null>(null);
  const [equipment,setEquipment] = useState<EquipmentName>("Picomaster");
  const [events,setEvents] = useState<Event[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [msg,setMsg] = useState("Tap an empty time slot to request a reservation.");
  const [mobile,setMobile] = useState(false);

  useEffect(()=>{ const c=()=>setMobile(window.matchMedia("(max-width:760px)").matches); c(); window.addEventListener("resize",c); return()=>window.removeEventListener("resize",c); },[]);

  useEffect(()=>{ (async()=>{
    const supabase = getBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if(!token){ router.push("/login"); return; }
    const res = await fetch("/api/me", { headers:{ Authorization:`Bearer ${token}` }});
    if(!res.ok){ router.push("/login"); return; }
    const profile = await res.json();
    setMe(profile);
    const first = EQUIPMENT.find(e=>profile.permissions.includes(e));
    if(first) setEquipment(first);
  })(); },[router]);

  const load = useCallback(async()=>{
    const res = await fetch(`/api/reservations?equipment=${encodeURIComponent(equipment)}`, { cache:"no-store" });
    const data = await res.json();
    if(res.ok) setEvents(data.events || []);
  },[equipment]);
  useEffect(()=>{ load(); },[load]);

  const initialView = useMemo(()=> mobile ? "timeGridDay" : "timeGridWeek", [mobile]);
  const allowed = !!me?.permissions.includes(equipment);

  function click(arg: DateClickArg){
    if(!me) return;
    if(me.status !== "approved"){ setMsg("Your account is waiting for administrator approval."); return; }
    if(!allowed){ setMsg(`You do not have permission to reserve ${equipment}.`); return; }
    setSelected(arg.dateStr.length>10 ? arg.dateStr.slice(0,16) : `${arg.dateStr}T09:00`);
  }

  if(!me) return <section className="card">Loading...</section>;

  return (
    <>
      <section className="header">
        <Nav isAdmin={me.isAdmin}/>
        <p className="eyebrow">SHARED FACILITIES</p>
        <h1>Equipment Reservation</h1>
        <p className="subtitle">
          Signed in as {me.name}. {me.status === "approved" ? "Select an authorized equipment and request a reservation." : "Your account is waiting for administrator approval."}
        </p>
      </section>

      <section className="card">
        <div className="tabs">
          {EQUIPMENT.map(e=>(
            <button key={e} className={`tab ${equipment===e?"active":""}`} onClick={()=>setEquipment(e)}>
              {e}{me.permissions.includes(e) ? "" : " · no access"}
            </button>
          ))}
        </div>
        <div className="help">
          <span className="legend"><span className="dot approved"/> Approved</span>
          <span className="legend"><span className="dot pending"/> Pending</span>
          <span>{allowed ? "You can reserve this equipment." : "You do not have permission for this equipment."}</span>
        </div>
        <FullCalendar
          key={initialView}
          plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]}
          initialView={initialView}
          headerToolbar={{ left:"prev,next today", center:"title", right: mobile ? "timeGridDay" : "dayGridMonth,timeGridWeek,timeGridDay" }}
          height="auto"
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          nowIndicator
          selectable
          dateClick={click}
          events={events.map(e=>({ id:e.id, title:e.title, start:e.start, end:e.end, classNames:[e.status==="approved"?"event-approved":"event-pending"] }))}
          eventContent={(arg)=><div><strong>{arg.timeText}</strong><div>{arg.event.title}</div></div>}
        />
        <div className="status">{msg}</div>
      </section>

      {selected && <BookingModal me={me} equipment={equipment} initialStart={selected} onClose={()=>setSelected(null)} onSubmitted={async()=>{setSelected(null); setMsg("Reservation request submitted. Approval is pending."); await load();}} />}
    </>
  );
}
