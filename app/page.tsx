import BookingCalendar from "@/components/BookingCalendar";
import PwaInstall from "@/components/PwaInstall";

export default function Home() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="app-brand" href="/" aria-label="Equipment Reservation home">
            <span className="brand-mark">ER</span>
            <span>
              <strong>Equipment Reservation</strong>
              <small>Shared equipment booking</small>
            </span>
          </a>
          <PwaInstall />
        </div>
      </header>

      <main className="app-main">
        <section className="app-intro">
          <div>
            <div className="eyebrow">RESERVATION CALENDAR</div>
            <h1>Book shared equipment.</h1>
            <p>
              Select an instrument, check the schedule, and tap an empty time slot to request a reservation.
              Requests become final after approval.
            </p>
          </div>
          <div className="intro-note">
            <strong>Before you book</strong>
            <span>Only authorized users can submit requests.</span>
            <span>Approved users receive a reminder about 5 minutes before start time.</span>
          </div>
        </section>

        <BookingCalendar />
      </main>

      <footer className="app-footer">
        <span>Equipment Reservation</span>
        <span>Times are displayed in Korea Standard Time (KST).</span>
      </footer>
    </>
  );
}
