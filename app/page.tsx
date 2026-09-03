import BookingCalendar from "@/components/BookingCalendar";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SHARED FACILITIES</p>
          <h1>Equipment Reservation</h1>
          <p className="subtitle">
            Reserve Picomaster, Ellionix, or Magnetic Annealing.
            Requests become final after approval.
          </p>
        </div>
      </header>

      <BookingCalendar />

      <footer className="footer">
        <span>Equipment Reservation</span>
        <span>Install this site on your phone to use it like an app.</span>
      </footer>
    </main>
  );
}
