import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export async function getAuthUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireAdmin(req: Request) {
  const user = await getAuthUser(req);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
    throw new Error("ADMIN_REQUIRED");
  }
  return user;
}

export function newRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashApprovalToken(token: string) {
  const secret = process.env.APPROVAL_SECRET;
  if (!secret) throw new Error("APPROVAL_SECRET is missing.");
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
  const full = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return { start: full.format(new Date(start)), end: full.format(new Date(end)) };
}
