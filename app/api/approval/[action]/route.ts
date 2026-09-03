import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, formatSeoulRange, getAdminSupabase, hashApprovalToken } from "@/lib/server";

export async function GET(req:NextRequest, context:{params:Promise<{action:string}>}) {
  const { action } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !["approve","decline"].includes(action)) return page("Invalid request","The approval link is invalid.",false);
  try {
    const supabase = getAdminSupabase();
    const { data:r } = await supabase.from("reservations").select("*").eq("approval_token_hash", hashApprovalToken(token)).maybeSingle();
    if (!r) return page("Link not found","This approval link is invalid or already used.",false);
    if (r.status !== "pending") return page("Already processed",`This request is already ${r.status}.`,true);
    if (action === "approve") {
      const { data:conflicts } = await supabase.from("reservations").select("id").eq("equipment", r.equipment).eq("status","approved").neq("id",r.id).lt("start_time",r.end_time).gt("end_time",r.start_time);
      if ((conflicts||[]).length) return page("Cannot approve","Another approved reservation overlaps with this request.",false);
    }
    const status = action === "approve" ? "approved" : "declined";
    await supabase.from("reservations").update({ status, approval_token_hash:null, reviewed_at:new Date().toISOString() }).eq("id",r.id);
    await resultEmail(r,status);
    return page(status==="approved"?"Reservation approved":"Reservation declined",`${r.equipment} reservation for ${r.name} has been ${status}.`,true);
  } catch(e) { console.error(e); return page("Something went wrong","The request could not be processed.",false); }
}
async function resultEmail(r:any,status:string){
  const key=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM; if(!key||!from) return;
  const range = formatSeoulRange(r.start_time,r.end_time);
  await new Resend(key).emails.send({ from, to:r.email, subject:`[Equipment Reservation] ${status==="approved"?"Approved":"Declined"} — ${r.equipment}`,
    html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827"><div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div><h1 style="font-family:Georgia,serif;font-weight:400">Reservation ${escapeHtml(status)}</h1><p>Your reservation for <b>${escapeHtml(r.equipment)}</b> has been <b>${escapeHtml(status)}</b>.</p><p>${escapeHtml(range.start)} – ${escapeHtml(range.end)}</p></div>` });
}
function page(title:string,msg:string,ok:boolean){
  return new NextResponse(`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;color:#111827"><div style="max-width:680px;margin:90px auto;padding:34px;text-align:center;background:#fff;border:1px solid #e5e7eb;border-radius:24px"><div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div><h1 style="font-family:Georgia,serif;font-weight:400;color:${ok?"#1d4ed8":"#991b1b"}">${escapeHtml(title)}</h1><p style="color:#6b7280">${escapeHtml(msg)}</p><a href="/" style="display:inline-block;margin-top:20px;padding:11px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px">Open calendar</a></div></body></html>`, { headers:{ "Content-Type":"text/html; charset=utf-8" }});
}
