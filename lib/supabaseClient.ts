"use client";

import { createClient, Session } from "@supabase/supabase-js";

const SESSION_STARTED_KEY = "equipmentReservation:sessionStartedAt";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserSupabase() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase browser environment variables are missing.");

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });
  return browserClient;
}

export function markSessionStarted() {
  window.localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
}

export function clearAppSessionMarker() {
  window.localStorage.removeItem(SESSION_STARTED_KEY);
}

export async function getValidSession(): Promise<Session | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    clearAppSessionMarker();
    return null;
  }

  let started = Number(window.localStorage.getItem(SESSION_STARTED_KEY) || "0");

  // Existing users upgrading to this version should not be logged out immediately.
  // Start their seven-day window on the first successful session restore.
  if (!started) {
    started = Date.now();
    window.localStorage.setItem(SESSION_STARTED_KEY, String(started));
  }

  if (Date.now() - started >= SESSION_MAX_AGE_MS) {
    await supabase.auth.signOut();
    clearAppSessionMarker();
    return null;
  }

  return session;
}
