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

export function cronAuthorized(req: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const authorization = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const urlSecret = new URL(req.url).searchParams.get("secret");
  return authorization === `Bearer ${configured}` || headerSecret === configured || urlSecret === configured;
}

export async function sendReservationResultEmail(r:any,status:"approved"|"declined",reason?:string){
  const key=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM;
  if(!key||!from||!r.email) return false;
  const { Resend } = await import("resend");
  const range=formatSeoulRange(r.start_time,r.end_time);
  const label=status==="approved"?"Approved":"Declined";
  const detail=reason?`<p><b>Reason:</b> ${escapeHtml(reason)}</p>`:"";
  const {error}=await new Resend(key).emails.send({
    from,to:r.email,subject:`[Equipment Reservation] ${label} — ${r.equipment}`,
    html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827"><div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div><h1 style="font-family:Georgia,serif;font-weight:400">Reservation ${escapeHtml(status)}</h1><p>Hello ${escapeHtml(r.name)},</p><p>Your reservation for <b>${escapeHtml(r.equipment)}</b> has been <b>${escapeHtml(status)}</b>.</p><p>${escapeHtml(range.start)} – ${escapeHtml(range.end)}</p>${detail}</div>`
  });
  if(error){console.error("Reservation result email failed:",error);return false}
  return true;
}
