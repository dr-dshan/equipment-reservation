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

function withinSevenDays() {
  let started = Number(window.localStorage.getItem(SESSION_STARTED_KEY) || "0");
  if (!started) {
    started = Date.now();
    window.localStorage.setItem(SESSION_STARTED_KEY, String(started));
  }
  return Date.now() - started < SESSION_MAX_AGE_MS;
}

async function enforceSevenDays(session: Session | null): Promise<Session | null> {
  if (!session) return null;
  if (withinSevenDays()) return session;

  const supabase = getBrowserSupabase();
  await supabase.auth.signOut();
  clearAppSessionMarker();
  return null;
}

/**
 * Wait for Supabase to restore its persisted auth state instead of redirecting
 * during the first render. getSession() is checked first for the common fast path;
 * if it is empty we briefly wait for INITIAL_SESSION/SIGNED_IN.
 */
export async function restoreValidSession(timeoutMs = 1800): Promise<Session | null> {
  const supabase = getBrowserSupabase();

  const { data } = await supabase.auth.getSession();
  if (data.session) return enforceSevenDays(data.session);

  return new Promise<Session | null>((resolve) => {
    let finished = false;

    const finish = async (session: Session | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(await enforceSevenDays(session));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        finish(session);
      }
    });

    const timer = window.setTimeout(async () => {
      const { data: retry } = await supabase.auth.getSession();
      finish(retry.session);
    }, timeoutMs);
  });
}

export const getValidSession = restoreValidSession;
