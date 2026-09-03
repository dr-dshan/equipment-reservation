import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase, hashApprovalToken } from "@/lib/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
  const token = req.nextUrl.searchParams.get("token");

  if (!token || !["approve", "decline"].includes(action)) {
    return resultPage("Invalid request", "The approval link is invalid.", false);
  }

  try {
    const supabase = getAdminSupabase();
    const tokenHash = hashApprovalToken(token);

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("approval_token_hash", tokenHash)
      .maybeSingle();

    if (error) throw error;
    if (!reservation) return resultPage("Link not found", "This approval link is invalid or no longer available.", false);
    if (reservation.status !== "pending") {
      return resultPage("Already processed", `This request is already ${reservation.status}.`, true);
    }

    if (action === "approve") {
      const { data: conflicts, error: conflictError } = await supabase
        .from("reservations")
        .select("id")
        .eq("equipment", reservation.equipment)
        .eq("status", "approved")
        .neq("id", reservation.id)
        .lt("start_time", reservation.end_time)
        .gt("end_time", reservation.start_time);

      if (conflictError) throw conflictError;
      if ((conflicts ?? []).length > 0) {
        return resultPage(
          "Cannot approve",
          "Another approved reservation now overlaps with this request. Please review the calendar.",
          false
        );
      }
    }

    const newStatus = action === "approve" ? "approved" : "declined";
    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        status: newStatus,
        approval_token_hash: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

    if (updateError) throw updateError;

    await sendUserResultEmail(reservation, newStatus);

    return resultPage(
      newStatus === "approved" ? "Reservation approved" : "Reservation declined",
      `${reservation.equipment} reservation for ${reservation.name} has been ${newStatus}.`,
      true
    );
  } catch (e) {
    console.error(e);
    return resultPage("Something went wrong", "The request could not be processed.", false);
  }
}

async function sendUserResultEmail(reservation: any, status: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from || !reservation.email) return;

  const resend = new Resend(key);
  const approved = status === "approved";

  await resend.emails.send({
    from,
    to: reservation.email,
    subject: `[Equipment Reservation] ${approved ? "Approved" : "Declined"} — ${reservation.equipment}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717">
        <div style="font-size:12px;letter-spacing:.14em;color:#777;margin-bottom:14px">EQUIPMENT RESERVATION</div>
        <h1 style="font-family:Georgia,serif;font-weight:400">
          Reservation ${approved ? "approved" : "declined"}
        </h1>
        <p>Your reservation request for <b>${reservation.equipment}</b> has been <b>${status}</b>.</p>
        <p style="color:#777;font-size:13px">Please check the reservation calendar for the current schedule.</p>
      </div>
    `,
  });
}

function resultPage(title: string, message: string, ok: boolean) {
  const color = ok ? "#153b66" : "#9b2c2c";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>${title}</title></head>
    <body style="font-family:Arial,sans-serif;color:#171717;margin:0">
      <div style="max-width:680px;margin:110px auto;padding:0 24px;text-align:center">
        <div style="font-size:12px;letter-spacing:.14em;color:#777;margin-bottom:16px">EQUIPMENT RESERVATION</div>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:48px;margin-bottom:18px;color:${color}">${title}</h1>
        <p style="color:#666;line-height:1.6">${message}</p>
        <a href="/" style="display:inline-block;margin-top:24px;padding:11px 18px;background:#171717;color:#fff;text-decoration:none;border-radius:6px">Open reservation calendar</a>
      </div>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
