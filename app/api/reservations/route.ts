import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase, hashApprovalToken, newApprovalToken } from "@/lib/server";

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
      return NextResponse.json({ error: "Invalid reservation time." }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: allowed, error: allowedError } = await supabase
      .from("allowed_users")
      .select("email")
      .eq("email", String(email).toLowerCase())
      .eq("active", true)
      .maybeSingle();

    if (allowedError) throw allowedError;
    if (!allowed) {
      return NextResponse.json(
        { error: "This email is not authorized to request equipment reservations." },
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

    const token = newApprovalToken();
    const tokenHash = hashApprovalToken(token);

    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        equipment,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!siteUrl || !adminEmail || !resendKey || !from) {
      throw new Error("Email environment variables are not configured.");
    }

    const approveUrl = `${siteUrl}/api/approval/approve?token=${encodeURIComponent(token)}`;
    const declineUrl = `${siteUrl}/api/approval/decline?token=${encodeURIComponent(token)}`;

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from,
      to: adminEmail,
      subject: `[Equipment Reservation] ${equipment} — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171717">
          <div style="font-size:12px;letter-spacing:.14em;color:#777;margin-bottom:14px">EQUIPMENT RESERVATION</div>
          <h1 style="font-family:Georgia,serif;font-weight:400;margin:0 0 24px">New reservation request</h1>
          <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.6">
            <tr><td style="padding:7px 0;color:#777;width:160px">Equipment</td><td><b>${escapeHtml(equipment)}</b></td></tr>
            <tr><td style="padding:7px 0;color:#777">User</td><td>${escapeHtml(name)}</td></tr>
            <tr><td style="padding:7px 0;color:#777">Email</td><td>${escapeHtml(email)}</td></tr>
            <tr><td style="padding:7px 0;color:#777">Supervisor</td><td>${escapeHtml(supervisor)}</td></tr>
            <tr><td style="padding:7px 0;color:#777">Start</td><td>${fmt.format(startDate)}</td></tr>
            <tr><td style="padding:7px 0;color:#777">End</td><td>${fmt.format(endDate)}</td></tr>
            <tr><td style="padding:7px 0;color:#777;vertical-align:top">Purpose</td><td>${escapeHtml(purpose)}</td></tr>
            <tr><td style="padding:7px 0;color:#777;vertical-align:top">Notes</td><td>${escapeHtml(notes || "—")}</td></tr>
          </table>
          <div style="margin-top:30px">
            <a href="${approveUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;margin-right:10px">APPROVE</a>
            <a href="${declineUrl}" style="display:inline-block;background:#fff;color:#9b2c2c;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:700;border:1px solid #d9d9d9">DECLINE</a>
          </div>
          <p style="font-size:12px;color:#888;margin-top:26px">Reservation ID: ${reservation.id}</p>
        </div>
      `,
    });

    if (emailError) throw emailError;

    return NextResponse.json({ ok: true, id: reservation.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit the reservation request." }, { status: 500 });
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
