"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import BookingModal from "./BookingModal";

const EQUIPMENT = ["Picomaster", "Ellionix", "Magnetic Annealing"] as const;

type ReservationEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: "pending" | "approved";
};

export default function BookingCalendar() {
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]>("Picomaster");
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [message, setMessage] = useState("Tap an empty time slot to request a reservation.");
  const [calendarView, setCalendarView] = useState("timeGridWeek");

  useEffect(() => {
    const chooseView = () => setCalendarView(window.innerWidth <= 720 ? "timeGridDay" : "timeGridWeek");
    chooseView();
    window.addEventListener("resize", chooseView);
    return () => window.removeEventListener("resize", chooseView);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/reservations?equipment=${encodeURIComponent(equipment)}`, { cache: "no-store" });
    if (!res.ok) {
      setMessage("Could not load the reservation calendar.");
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
  }, [equipment]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function handleDateClick(arg: DateClickArg) {
    const date = arg.dateStr.length > 10 ? arg.dateStr.slice(0, 16) : `${arg.dateStr}T09:00`;
    setSelectedDate(date);
  }

  const calendarEvents = useMemo(() => events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    classNames: [e.status === "approved" ? "event-approved" : "event-pending"],
    extendedProps: { status: e.status },
  })), [events]);

  return (
    <section className="booking-shell">
      <div className="equipment-section">
        <div className="section-heading">
          <span>Equipment</span>
          <small>Choose an instrument to view its schedule.</small>
        </div>
        <div className="equipment-tabs" role="tablist" aria-label="Equipment">
          {EQUIPMENT.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={equipment === name}
              className={`equipment-tab ${equipment === name ? "active" : ""}`}
              onClick={() => setEquipment(name)}
            >
              <span className="equipment-dot" />
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-card">
        <div className="calendar-card-head">
          <div>
            <span className="calendar-equipment-label">CURRENT SCHEDULE</span>
            <h2>{equipment}</h2>
          </div>
          <div className="calendar-help">
            <span className="legend"><span className="legend-dot approved" /> Approved</span>
            <span className="legend"><span className="legend-dot pending" /> Pending</span>
          </div>
        </div>

        <div className="calendar-frame">
          <FullCalendar
            key={calendarView}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={calendarView}
            headerToolbar={calendarView === "timeGridDay"
              ? { left: "prev,next", center: "title", right: "today" }
              : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
            height="auto"
            allDaySlot={false}
            slotMinTime="08:00:00"
            slotMaxTime="23:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            nowIndicator
            selectable
            selectMirror
            dateClick={handleDateClick}
            events={calendarEvents}
            eventContent={(arg) => (
              <div className="event-inner">
                <strong>{arg.timeText}</strong>
                <span>{arg.event.title}</span>
              </div>
            )}
          />
        </div>

        <div className="status-line">
          <span className="status-icon">i</span>
          {message}
        </div>
      </div>

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
