import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, getAdminSupabase } from "@/lib/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, supervisor } = await req.json();
    if (!name || !email || !password || !supervisor) return NextResponse.json({ error:"Please fill in all fields." }, { status:400 });
    const normalizedEmail = String(email).trim().toLowerCase();
    const supabase = getAdminSupabase();

    const { data: auth, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name, supervisor }
    });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: auth.user.id,
      email: normalizedEmail,
      name: String(name).trim(),
      supervisor: String(supervisor).trim(),
      status: "pending"
    });
    if (profileError) throw profileError;

    await notifyAdmin(name, normalizedEmail, supervisor);
    return NextResponse.json({ ok:true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error:e.message || "Could not create account." }, { status:500 });
  }
}

async function notifyAdmin(name:string, email:string, supervisor:string) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM, to = process.env.ADMIN_EMAIL, site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !from || !to || !site) return;
  const resend = new Resend(key);
  await resend.emails.send({
    from, to, subject: `[Equipment Reservation] New user registration — ${name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827">
      <div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div>
      <h1 style="font-family:Georgia,serif;font-weight:400">New user registration</h1>
      <p><b>Name:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Supervisor:</b> ${escapeHtml(supervisor)}</p>
      <p><a href="${site.replace(/\/$/,"")}/admin" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">OPEN ADMIN PAGE</a></p>
    </div>`
  });
}
