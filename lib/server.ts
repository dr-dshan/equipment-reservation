import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase server environment variables are not configured.");
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

export function hashApprovalToken(token: string) {
  const secret = process.env.APPROVAL_SECRET;
  if (!secret) throw new Error("APPROVAL_SECRET is not configured.");
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function newApprovalToken() {
  return crypto.randomBytes(32).toString("hex");
}
