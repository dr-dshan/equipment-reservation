import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isEquipment } from "@/lib/equipment";
import { escapeHtml, formatSeoulRange, getAdminSupabase, getAuthUser, hashApprovalToken, newRandomToken } from "@/lib/server";

export async function GET(req: NextRequest) {
  try {
    const equipment = req.nextUrl.searchParams.get("equipment");
    if (!isEquipment(equipment)) return NextResponse.json({ error:"Invalid equipment." }, { status:400 });
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from("reservations").select("id,name,start_time,end_time,status").eq("equipment", equipment).in("status", ["pending","approved"]).order("start_time");
    if (error) throw error;
    return NextResponse.json({ events:(data||[]).map(r=>({ id:r.id, title:r.name, start:r.start_time, end:r.end_time, status:r.status })) });
  } catch(e) {
    console.error(e); return NextResponse.json({ error:"Could not load reservations." }, { status:500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error:"Please log in." }, { status:401 });
    const { equipment, start, end, purpose, notes } = await req.json();
    if (!isEquipment(equipment) || !start || !end || !purpose) return NextResponse.json({ error:"Please fill in all required fields." }, { status:400 });
    const startDate = new Date(start), endDate = new Date(end);
    if (!(endDate > startDate)) return NextResponse.json({ error:"End time must be later than start time." }, { status:400 });

    const supabase = getAdminSupabase();
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile || profile.status !== "approved") return NextResponse.json({ error:"Your account is not approved yet." }, { status:403 });

    const { data: perm } = await supabase.from("equipment_permissions").select("allowed").eq("user_id", user.id).eq("equipment", equipment).eq("allowed", true).maybeSingle();
    if (!perm) return NextResponse.json({ error:`You are not authorized to reserve ${equipment}.` }, { status:403 });

    const { data: conflicts } = await supabase.from("reservations").select("id").eq("equipment", equipment).in("status", ["pending","approved"]).lt("start_time", endDate.toISOString()).gt("end_time", startDate.toISOString());
    if ((conflicts||[]).length) return NextResponse.json({ error:"The selected time overlaps with an existing reservation or pending request." }, { status:409 });

    const token = newRandomToken();
    const { data: reservation, error } = await supabase.from("reservations").insert({
      user_id:user.id, equipment, name:profile.name, email:profile.email, supervisor:profile.supervisor,
      purpose:String(purpose).trim(), notes:String(notes||"").trim(),
      start_time:startDate.toISOString(), end_time:endDate.toISOString(), status:"pending",
      approval_token_hash:hashApprovalToken(token)
    }).select("id").single();
    if (error) throw error;
    await sendAdminReservationEmail({ id:reservation.id, equipment, profile, purpose, notes, start:startDate, end:endDate, token });
    return NextResponse.json({ ok:true, id:reservation.id });
  } catch(e) {
    console.error(e); return NextResponse.json({ error:"Could not submit reservation." }, { status:500 });
  }
}

async function sendAdminReservationEmail(input:any) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,""), key=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM, to=process.env.ADMIN_EMAIL;
  if (!site || !key || !from || !to) throw new Error("Email environment variables are missing.");
  const range = formatSeoulRange(input.start,input.end);
  const approve = `${site}/api/approval/approve?token=${encodeURIComponent(input.token)}`;
  const decline = `${site}/api/approval/decline?token=${encodeURIComponent(input.token)}`;
  const resend = new Resend(key);
  await resend.emails.send({
    from, to, subject:`[Equipment Reservation] ${input.equipment} — ${input.profile.name}`,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827">
      <div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div>
      <h1 style="font-family:Georgia,serif;font-weight:400">New reservation request</h1>
      <p><b>Equipment:</b> ${escapeHtml(input.equipment)}</p><p><b>User:</b> ${escapeHtml(input.profile.name)}</p>
      <p><b>Email:</b> ${escapeHtml(input.profile.email)}</p><p><b>Supervisor:</b> ${escapeHtml(input.profile.supervisor)}</p>
      <p><b>Start:</b> ${escapeHtml(range.start)}</p><p><b>End:</b> ${escapeHtml(range.end)}</p>
      <p><b>Purpose:</b> ${escapeHtml(input.purpose)}</p><p><b>Notes:</b> ${escapeHtml(input.notes||"—")}</p>
      <p><a href="${approve}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;margin-right:10px">APPROVE</a>
      <a href="${decline}" style="display:inline-block;background:#fff;color:#991b1b;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;border:1px solid #d1d5db">DECLINE</a></p>
      <p style="font-size:12px;color:#9ca3af">Reservation ID: ${escapeHtml(input.id)}</p>
    </div>`
  });
}
