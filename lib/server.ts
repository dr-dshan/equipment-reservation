import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function newRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string, secretName: "APPROVAL_SECRET" | "CRON_SECRET" = "APPROVAL_SECRET") {
  const secret = process.env[secretName];
  if (!secret) throw new Error(`${secretName} is not configured.`);
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatSeoulRange(start: string | Date, end: string | Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    start: formatter.format(new Date(start)),
    end: formatter.format(new Date(end)),
  };
}
