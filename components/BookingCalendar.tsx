"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { EQUIPMENT, EquipmentName } from "@/lib/equipment";
import BookingModal from "./BookingModal";
import EditReservationModal from "./EditReservationModal";
import Nav from "./Nav";

type Me = { id:string; email:string; name:string; supervisor:string; status:string; isAdmin:boolean; permissions:string[] };
type Event = { id:string; title:string; start:string; end:string; status:"pending"|"approved"; isMine:boolean; purpose?:string; notes?:string };

export default function BookingCalendar(){
  const router = useRouter();
  const [me,setMe] = useState<Me|null>(null);
  const [equipment,setEquipment] = useState<EquipmentName>("Picomaster");
  const [events,setEvents] = useState<Event[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [editing,setEditing] = useState<Event|null>(null);
  const [msg,setMsg] = useState("Tap an empty time slot to request a reservation.");
  const [mobile,setMobile] = useState(false);
  const calendarRef = useRef<FullCalendar|null>(null);
  const restoredCalendar = useRef(false);

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
    const available = profile.isAdmin ? [...EQUIPMENT] : EQUIPMENT.filter(e=>profile.permissions.includes(e));
    const savedEquipment = window.localStorage.getItem("aedlab:lastEquipment");
    const first = available.includes(savedEquipment as EquipmentName) ? savedEquipment as EquipmentName : available[0];
    if(first) setEquipment(first);
  })(); },[router]);

  useEffect(()=>{
    if(me && equipment) window.localStorage.setItem("aedlab:lastEquipment",equipment);
  },[me,equipment]);

  const load = useCallback(async()=>{
    const { data: sessionData } = await getBrowserSupabase().auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/reservations?equipment=${encodeURIComponent(equipment)}&t=${Date.now()}`, {
      cache:"no-store",
      headers:{ Authorization:`Bearer ${token}` }
    });
    const data = await res.json();
    if(res.ok) setEvents(data.events || []);
    else setEvents([]);
  },[equipment]);
  useEffect(()=>{ load(); },[load]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{ if(document.visibilityState==="visible") load(); },8000);
    const refresh=()=>load();
    const visible=()=>{ if(document.visibilityState==="visible") load(); };
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",visible);
    return()=>{ window.clearInterval(timer); window.removeEventListener("focus",refresh); document.removeEventListener("visibilitychange",visible); };
  },[load]);

  const initialView = useMemo(()=>{
    if(typeof window==="undefined") return mobile ? "timeGridDay" : "timeGridWeek";
    return window.localStorage.getItem("aedlab:lastCalendarView") || (mobile ? "timeGridDay" : "timeGridWeek");
  },[mobile]);
  const visibleEquipment = me?.isAdmin ? [...EQUIPMENT] : EQUIPMENT.filter(e=>me?.permissions.includes(e));
  const allowed = !!me?.isAdmin || !!me?.permissions.includes(equipment);

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
          {visibleEquipment.map(e=>(
            <button key={e} className={`tab ${equipment===e?"active":""}`} onClick={()=>setEquipment(e)}>
              {e}
            </button>
          ))}
        </div>
        <div className="help">
          <span className="legend"><span className="dot approved"/> Approved</span>
          <span className="legend"><span className="dot pending"/> Pending</span>
          <span>{allowed ? "You can reserve this equipment." : "You do not have permission for this equipment."}</span>
        </div>
        {visibleEquipment.length === 0 ? (
          <div className="status">No equipment access has been assigned yet. Please contact the administrator.</div>
        ) : (
          <>
            <FullCalendar
              ref={calendarRef}
              key={`${initialView}-${equipment}`}
              initialDate={typeof window!=="undefined" ? (window.localStorage.getItem("aedlab:lastCalendarDate") || undefined) : undefined}
              plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]}
              initialView={initialView}
              datesSet={(arg)=>{
                window.localStorage.setItem("aedlab:lastCalendarView",arg.view.type);
                const api=arg.view.calendar;
                window.localStorage.setItem("aedlab:lastCalendarDate",api.getDate().toISOString());
              }}
              headerToolbar={{ left:"prev,next today", center:"title", right: mobile ? "timeGridDay" : "dayGridMonth,timeGridWeek,timeGridDay" }}
              height="auto"
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="23:00:00"
              slotDuration="00:30:00"
              nowIndicator
              selectable
              dateClick={click}
              eventClick={(arg)=>{
                const mine=events.find(e=>e.id===arg.event.id);
                if(mine?.isMine) setEditing(mine);
                else setMsg("Only the owner can edit or cancel this reservation.");
              }}
              events={events.map(e=>({ id:e.id, title:e.title, start:e.start, end:e.end, classNames:[e.status==="approved"?"event-approved":"event-pending"] }))}
              eventContent={(arg)=><div><strong>{arg.timeText}</strong><div>{arg.event.title}</div></div>}
            />
            <div className="status">{msg}</div>
          </>
        )}
      </section>

      {selected && <BookingModal me={me} equipment={equipment} initialStart={selected} onClose={()=>setSelected(null)} onSubmitted={async()=>{setSelected(null); setMsg("Reservation request submitted. Approval is pending."); await load();}} />}
      {editing && <EditReservationModal reservation={{...editing,equipment}} onClose={()=>setEditing(null)} onChanged={async(message)=>{setEditing(null);setMsg(message);await load();}} />}
    </>
  );
}
