import BookingCalendar from "@/components/BookingCalendar";
export default function Home() {
  return (
    <main className="shell">
      <BookingCalendar />
      <footer className="footer">
        <span>Equipment Reservation</span>
        <span>Install this site on your phone to use it like an app.</span>
      </footer>
    </main>
  );
}
