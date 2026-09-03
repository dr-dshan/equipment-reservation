import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, formatSeoulRange, getAdminSupabase, hashToken, newRandomToken } from "@/lib/server";

const EQUIPMENT = ["Picomaster", "Ellionix", "Magnetic Annealing"];

export async function GET(req: NextRequest) {
  try {
    const equipment = req.nextUrl.searchParams.get("equipment");

    if (!equipment || !EQUIPMENT.includes(equipment)) {
      return NextResponse.json({ error: "Invalid equipment." }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data, error } = await supabase
      .from("reservations")
      .select("id,name,start_time,end_time,status")
      .eq("equipment", equipment)
      .in("status", ["pending", "approved"])
      .order("start_time");

    if (error) throw error;

    return NextResponse.json({
      events: (data ?? []).map((r) => ({
        id: r.id,
        title: r.name,
        start: r.start_time,
        end: r.end_time,
        status: r.status,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load reservations." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipment, name, email, supervisor, purpose, notes, start, end } = body;

    if (!EQUIPMENT.includes(equipment) || !name || !email || !supervisor || !purpose || !start || !end) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (!(endDate > startDate)) {
      return NextResponse.json({ error: "End time must be later than start time." }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,email,name,active")
      .eq("email", normalizedEmail)
      .eq("active", true)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json(
        { error: "This email is not registered as an authorized user." },
        { status: 403 }
      );
    }

    const { data: permission, error: permissionError } = await supabase
      .from("equipment_permissions")
      .select("allowed")
      .eq("user_id", user.id)
      .eq("equipment", equipment)
      .eq("allowed", true)
      .maybeSingle();

    if (permissionError) throw permissionError;

    if (!permission) {
      return NextResponse.json(
        { error: `You are not authorized to reserve ${equipment}.` },
        { status: 403 }
      );
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from("reservations")
      .select("id")
      .eq("equipment", equipment)
      .in("status", ["pending", "approved"])
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflictError) throw conflictError;

    if ((conflicts ?? []).length > 0) {
      return NextResponse.json(
        { error: "The selected time overlaps with an existing reservation or pending request." },
        { status: 409 }
      );
    }

    const token = newRandomToken();
    const tokenHash = hashToken(token, "APPROVAL_SECRET");

    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        equipment,
        name: String(name).trim(),
        email: normalizedEmail,
        supervisor: String(supervisor).trim(),
        purpose: String(purpose).trim(),
        notes: String(notes ?? "").trim(),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "pending",
        approval_token_hash: tokenHash,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    await sendAdminEmail({
      reservationId: reservation.id,
      equipment,
      name,
      email: normalizedEmail,
      supervisor,
      purpose,
      notes,
      start: startDate,
      end: endDate,
      token,
    });

    return NextResponse.json({ ok: true, id: reservation.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit the reservation request." }, { status: 500 });
  }
}

async function sendAdminEmail(input: {
  reservationId: string;
  equipment: string;
  name: string;
  email: string;
  supervisor: string;
  purpose: string;
  notes?: string;
  start: Date;
  end: Date;
  token: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const adminEmail = process.env.ADMIN_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!siteUrl || !adminEmail || !resendKey || !from) {
    throw new Error("Email environment variables are not configured.");
  }

  const approveUrl = `${siteUrl}/api/approval/approve?token=${encodeURIComponent(input.token)}`;
  const declineUrl = `${siteUrl}/api/approval/decline?token=${encodeURIComponent(input.token)}`;
  const range = formatSeoulRange(input.start, input.end);

  const resend = new Resend(resendKey);

  const { error } = await resend.emails.send({
    from,
    to: adminEmail,
    subject: `[Equipment Reservation] ${input.equipment} — ${input.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827">
        <div style="font-size:12px;letter-spacing:.14em;color:#6b7280;margin-bottom:14px">EQUIPMENT RESERVATION</div>
        <h1 style="font-family:Georgia,serif;font-weight:400;margin:0 0 24px">New reservation request</h1>
        <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.6">
          <tr><td style="padding:7px 0;color:#6b7280;width:150px">Equipment</td><td><b>${escapeHtml(input.equipment)}</b></td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">User</td><td>${escapeHtml(input.name)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Email</td><td>${escapeHtml(input.email)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Supervisor</td><td>${escapeHtml(input.supervisor)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Start</td><td>${escapeHtml(range.start)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">End</td><td>${escapeHtml(range.end)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;vertical-align:top">Purpose</td><td>${escapeHtml(input.purpose)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;vertical-align:top">Notes</td><td>${escapeHtml(input.notes || "—")}</td></tr>
        </table>
        <div style="margin-top:30px">
          <a href="${approveUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;margin-right:10px">APPROVE</a>
          <a href="${declineUrl}" style="display:inline-block;background:#fff;color:#991b1b;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;border:1px solid #d1d5db">DECLINE</a>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-top:26px">Reservation ID: ${escapeHtml(input.reservationId)}</p>
      </div>
    `,
  });

  if (error) throw error;
}
