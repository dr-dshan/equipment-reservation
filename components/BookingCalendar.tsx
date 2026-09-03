"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import BookingModal from "./BookingModal";
import InstallButton from "./InstallButton";

const EQUIPMENT = ["Picomaster", "Ellionix", "Magnetic Annealing"] as const;

type EquipmentName = (typeof EQUIPMENT)[number];

type ReservationEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: "pending" | "approved";
};

export default function BookingCalendar() {
  const [equipment, setEquipment] = useState<EquipmentName>("Picomaster");
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [message, setMessage] = useState("Tap an empty time slot to request a reservation.");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(max-width: 760px)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/reservations?equipment=${encodeURIComponent(equipment)}`, { cache: "no-store" });
    if (!res.ok) {
      setMessage("Could not load reservations.");
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
  }, [equipment]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const initialView = useMemo(() => (isMobile ? "timeGridDay" : "timeGridWeek"), [isMobile]);

  function handleDateClick(arg: DateClickArg) {
    const date = arg.dateStr.length > 10 ? arg.dateStr.slice(0, 16) : `${arg.dateStr}T09:00`;
    setSelectedDate(date);
  }

  return (
    <section className="booking-card">
      <div className="top-row">
        <div className="equipment-tabs">
          {EQUIPMENT.map((name) => (
            <button
              key={name}
              className={`equipment-tab ${equipment === name ? "active" : ""}`}
              onClick={() => setEquipment(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <InstallButton />
      </div>

      <div className="calendar-help">
        <span className="legend"><span className="legend-dot approved" /> Approved</span>
        <span className="legend"><span className="legend-dot pending" /> Pending</span>
        <span>Reservations show time and user name.</span>
      </div>

      <FullCalendar
        key={initialView}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: isMobile ? "timeGridDay" : "dayGridMonth,timeGridWeek,timeGridDay"
        }}
        height="auto"
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="23:00:00"
        slotDuration="00:30:00"
        nowIndicator
        selectable
        dateClick={handleDateClick}
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          classNames: [e.status === "approved" ? "event-approved" : "event-pending"],
        }))}
        eventContent={(arg) => (
          <div>
            <strong>{arg.timeText}</strong>
            <div>{arg.event.title}</div>
          </div>
        )}
      />

      <div className="status-line">{message}</div>

      {selectedDate && (
        <BookingModal
          equipment={equipment}
          initialStart={selectedDate}
          onClose={() => setSelectedDate(null)}
          onSubmitted={async () => {
            setSelectedDate(null);
            setMessage("Reservation request submitted. Approval is pending.");
            await loadEvents();
          }}
        />
      )}
    </section>
  );
}
