import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, formatSeoulRange, getAdminSupabase } from "@/lib/server";

export async function GET(req: NextRequest) {
  return handleReminder(req);
}

export async function POST(req: NextRequest) {
  return handleReminder(req);
}

async function handleReminder(req: NextRequest) {
  try {
    const supplied =
      req.headers.get("x-cron-secret") ||
      req.nextUrl.searchParams.get("secret");

    if (!process.env.CRON_SECRET || supplied !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!resendKey || !from) {
      throw new Error("Email environment variables are not configured.");
    }

    const supabase = getAdminSupabase();

    const now = new Date();
    const lower = new Date(now.getTime() + 4 * 60 * 1000);
    const upper = new Date(now.getTime() + 6 * 60 * 1000);

    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("status", "approved")
      .is("reminder_sent_at", null)
      .gte("start_time", lower.toISOString())
      .lte("start_time", upper.toISOString())
      .order("start_time");

    if (error) throw error;

    const resend = new Resend(resendKey);
    let sent = 0;

    for (const reservation of reservations ?? []) {
      const range = formatSeoulRange(reservation.start_time, reservation.end_time);

      const { error: emailError } = await resend.emails.send({
        from,
        to: reservation.email,
        subject: `${reservation.equipment} Reservation Reminder`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827">
            <div style="font-size:12px;letter-spacing:.14em;color:#6b7280;margin-bottom:14px">EQUIPMENT RESERVATION</div>
            <h1 style="font-family:Georgia,serif;font-weight:400">Your reservation starts in 5 minutes</h1>
            <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.6">
              <tr><td style="padding:7px 0;color:#6b7280;width:130px">Equipment</td><td><b>${escapeHtml(reservation.equipment)}</b></td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">Start</td><td>${escapeHtml(range.start)}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">End</td><td>${escapeHtml(range.end)}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280;vertical-align:top">Purpose</td><td>${escapeHtml(reservation.purpose)}</td></tr>
            </table>
          </div>
        `,
      });

      if (!emailError) {
        const { error: updateError } = await supabase
          .from("reservations")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", reservation.id)
          .is("reminder_sent_at", null);

        if (updateError) throw updateError;
        sent += 1;
      }
    }

    return NextResponse.json({ ok: true, checked: reservations?.length ?? 0, sent });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Reminder check failed." }, { status: 500 });
  }
}
