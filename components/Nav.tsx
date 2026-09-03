"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import InstallButton from "./InstallButton";

export default function Nav({ isAdmin=false }: { isAdmin?: boolean }) {
  const router = useRouter();
  async function logout() {
    await getBrowserSupabase().auth.signOut();
    router.push("/login");
  }
  return (
    <div className="nav">
      <Link className="pill dark" href="/">Equipment Reservation</Link>
      <div className="nav-links">
        <Link href="/">Calendar</Link>
        {isAdmin && <Link href="/admin">Admin</Link>}
        <InstallButton />
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
