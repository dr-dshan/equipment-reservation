"use client";

import { FormEvent, useMemo, useState } from "react";

export default function BookingModal({
  equipment,
  initialStart,
  onClose,
  onSubmitted,
}: {
  equipment: string;
  initialStart: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const initialDate = initialStart.slice(0, 10);
  const initialTime = initialStart.length >= 16 ? initialStart.slice(11, 16) : "09:00";
  const defaultEnd = useMemo(() => {
    const [h, m] = initialTime.split(":").map(Number);
    return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [initialTime]);

  const [form, setForm] = useState({
    date: initialDate,
    startTime: initialTime,
    endTime: defaultEnd,
    name: "",
    email: "",
    supervisor: "",
    purpose: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);
    if (!(end > start)) {
      setError("End time must be later than start time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment,
          ...form,
          start: start.toISOString(),
          end: end.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit reservation.");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">RESERVATION REQUEST</div>
            <h2>{equipment}</h2>
          </div>
          <button className="close-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>
            <div className="field">
              <label>Start time</label>
              <input type="time" value={form.startTime} onChange={(e) => setField("startTime", e.target.value)} required />
            </div>
            <div className="field">
              <label>End time</label>
              <input type="time" value={form.endTime} onChange={(e) => setField("endTime", e.target.value)} required />
            </div>
            <div className="field full">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
            </div>
            <div className="field full">
              <label>Supervisor</label>
              <input
                value={form.supervisor}
                onChange={(e) => setField("supervisor", e.target.value)}
                placeholder="e.g., Dong-Soo Han"
                required
              />
            </div>
            <div className="field full">
              <label>Purpose</label>
              <textarea value={form.purpose} onChange={(e) => setField("purpose", e.target.value)} required />
            </div>
            <div className="field full">
              <label>Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Request Reservation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
