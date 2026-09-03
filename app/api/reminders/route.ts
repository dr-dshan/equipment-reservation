import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/server";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const cronSecret = process.env.REMINDER_CRON_SECRET;

    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!resendKey || !from) {
      throw new Error("Email environment variables are not configured.");
    }

    const supabase = getAdminSupabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() + 4 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 6 * 60 * 1000);

    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("id,equipment,name,email,purpose,start_time,end_time,reminder_sent_at")
      .eq("status", "approved")
      .is("reminder_sent_at", null)
      .gte("start_time", windowStart.toISOString())
      .lt("start_time", windowEnd.toISOString())
      .order("start_time");

    if (error) throw error;

    const resend = new Resend(resendKey);
    const sent: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const reservation of reservations ?? []) {
      try {
        // Claim the reminder before sending so overlapping cron invocations
        // cannot send the same reminder twice.
        const claimedAt = new Date().toISOString();
        const { data: claimed, error: claimError } = await supabase
          .from("reservations")
          .update({ reminder_sent_at: claimedAt })
          .eq("id", reservation.id)
          .is("reminder_sent_at", null)
          .select("id")
          .maybeSingle();

        if (claimError) throw claimError;
        if (!claimed) continue;

        const start = new Date(reservation.start_time);
        const end = new Date(reservation.end_time);
        const dateFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const { error: emailError } = await resend.emails.send({
          from,
          to: reservation.email,
          subject: `${reservation.equipment} Reservation Reminder`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717">
              <div style="font-size:12px;letter-spacing:.14em;color:#777;margin-bottom:14px">EQUIPMENT RESERVATION</div>
              <h1 style="font-family:Georgia,serif;font-weight:400;margin:0 0 20px">Reservation reminder</h1>
              <p style="font-size:16px;line-height:1.6">Your reservation starts in approximately <b>5 minutes</b>.</p>
              <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.6;margin-top:20px">
                <tr><td style="padding:7px 0;color:#777;width:130px">Equipment</td><td><b>${escapeHtml(reservation.equipment)}</b></td></tr>
                <tr><td style="padding:7px 0;color:#777">Date</td><td>${dateFmt.format(start)}</td></tr>
                <tr><td style="padding:7px 0;color:#777">Time</td><td>${timeFmt.format(start)}–${timeFmt.format(end)}</td></tr>
                <tr><td style="padding:7px 0;color:#777;vertical-align:top">Purpose</td><td>${escapeHtml(reservation.purpose)}</td></tr>
              </table>
              <p style="font-size:12px;color:#888;margin-top:28px">This is an automatic equipment reservation reminder.</p>
            </div>
          `,
        });

        if (emailError) throw emailError;
        sent.push(reservation.id);
      } catch (e) {
        // Release the claim if sending failed, so the next cron run can retry.
        await supabase
          .from("reservations")
          .update({ reminder_sent_at: null })
          .eq("id", reservation.id);

        failed.push({
          id: reservation.id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checkedAt: now.toISOString(),
      sent,
      failed,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not process reminders." }, { status: 500 });
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
