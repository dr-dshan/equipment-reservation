import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isEquipment } from "@/lib/equipment";
import { escapeHtml, formatSeoulRange, getAdminSupabase, getAuthUser, hashApprovalToken, newRandomToken } from "@/lib/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error:"Please log in." }, { status:401 });

    const equipment = req.nextUrl.searchParams.get("equipment");
    if (!isEquipment(equipment)) return NextResponse.json({ error:"Invalid equipment." }, { status:400 });

    const supabase = getAdminSupabase();
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const isAdmin = user.email?.toLowerCase() === adminEmail;

    if (!isAdmin) {
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
      if (!profile || profile.status !== "approved")
        return NextResponse.json({ error:"Your account is not approved yet." }, { status:403 });

      const { data: perm } = await supabase.from("equipment_permissions")
        .select("allowed").eq("user_id", user.id).eq("equipment", equipment).eq("allowed", true).maybeSingle();
      if (!perm) return NextResponse.json({ error:"You do not have permission to view this equipment." }, { status:403 });
    }

    const { data, error } = await supabase.from("reservations")
      .select("id,user_id,name,start_time,end_time,status,purpose,notes")
      .eq("equipment", equipment).in("status", ["pending","approved"]).order("start_time");
    if (error) throw error;

    return NextResponse.json(
      { events:(data||[]).map(r=>({
          id:r.id, title:r.name, start:r.start_time, end:r.end_time, status:r.status,
          isMine:r.user_id===user.id,
          purpose:r.user_id===user.id ? r.purpose : undefined,
          notes:r.user_id===user.id ? r.notes : undefined
        })) },
      { headers:{ "Cache-Control":"private, max-age=10" } }
    );
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
  const { data: emailData, error: emailError } = await resend.emails.send({
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
  if (emailError) {
    console.error("Admin reservation notification failed:", emailError);
    throw new Error(`Admin email failed: ${emailError.message}`);
  }
  console.log("Admin reservation notification sent:", emailData?.id);
}


export async function PATCH(req:NextRequest){
  try{
    const user=await getAuthUser(req);
    if(!user) return NextResponse.json({error:"Please log in."},{status:401});
    const {id,start,end,purpose,notes}=await req.json();
    if(!id||!start||!end||!purpose) return NextResponse.json({error:"Missing required fields."},{status:400});
    const newStart=new Date(start), newEnd=new Date(end);
    if(!(newEnd>newStart)) return NextResponse.json({error:"End time must be later than start time."},{status:400});

    const supabase=getAdminSupabase();
    const {data:r,error:readError}=await supabase.from("reservations").select("*").eq("id",id).maybeSingle();
    if(readError) throw readError;
    if(!r) return NextResponse.json({error:"Reservation not found."},{status:404});
    if(r.user_id!==user.id) return NextResponse.json({error:"You can only edit your own reservation."},{status:403});
    if(!["pending","approved"].includes(r.status)) return NextResponse.json({error:`This reservation is ${r.status} and cannot be edited.`},{status:409});

    // The edited slot must not overlap another active request/reservation.
    const {data:conflicts,error:conflictError}=await supabase.from("reservations").select("id")
      .eq("equipment",r.equipment).in("status",["pending","approved"]).neq("id",id)
      .lt("start_time",newEnd.toISOString()).gt("end_time",newStart.toISOString());
    if(conflictError) throw conflictError;
    if((conflicts||[]).length) return NextResponse.json({error:"The edited time overlaps with another reservation or pending request."},{status:409});

    const oldStart=new Date(r.start_time), oldEnd=new Date(r.end_time);
    // No reapproval only when the new interval is wholly contained inside the old approved interval.
    // This covers later start, earlier end, or both. Any extension before/after the approved interval requires reapproval.
    const contained = newStart>=oldStart && newEnd<=oldEnd;
    const needsApproval = r.status==="pending" || !contained;

    let token:string|undefined;
    const update:any={
      start_time:newStart.toISOString(),end_time:newEnd.toISOString(),
      purpose:String(purpose).trim(),notes:String(notes||"").trim()
    };
    if(needsApproval){
      token=newRandomToken();
      update.status="pending";
      update.approval_token_hash=hashApprovalToken(token);
      update.reviewed_at=null;
    }

    const {error:updateError}=await supabase.from("reservations").update(update).eq("id",id);
    if(updateError) throw updateError;

    let notificationWarning:string|undefined;
    if(needsApproval && token){
      try{
        const {data:profile}=await supabase.from("profiles").select("*").eq("id",user.id).single();
        await sendAdminReservationEmail({
          id, equipment:r.equipment, profile, purpose, notes,
          start:newStart,end:newEnd,token
        });
      }catch(e:any){
        console.error("Edited reservation saved but admin notification failed:",e);
        notificationWarning=e?.message||"Admin email notification failed.";
      }
    }

    return NextResponse.json({
      ok:true,
      status:needsApproval?"pending":"approved",
      needsApproval,
      notificationWarning
    });
  }catch(e:any){
    console.error("Reservation edit error:",e);
    return NextResponse.json({error:e?.message||"Could not edit reservation."},{status:500});
  }
}

export async function DELETE(req:NextRequest){
  try{
    const user=await getAuthUser(req);
    if(!user) return NextResponse.json({error:"Please log in."},{status:401});
    const id=req.nextUrl.searchParams.get("id");
    if(!id) return NextResponse.json({error:"Reservation ID is required."},{status:400});
    const supabase=getAdminSupabase();
    const {data:r,error:readError}=await supabase.from("reservations").select("id,user_id,status").eq("id",id).maybeSingle();
    if(readError) throw readError;
    if(!r) return NextResponse.json({error:"Reservation not found."},{status:404});
    if(r.user_id!==user.id) return NextResponse.json({error:"You can only cancel your own reservation."},{status:403});
    if(!["pending","approved"].includes(r.status)) return NextResponse.json({error:`This reservation is already ${r.status}.`},{status:409});

    // Cancellation never requires administrator approval; keep the row for history.
    const {error}=await supabase.from("reservations").update({
      status:"cancelled",approval_token_hash:null,reviewed_at:new Date().toISOString()
    }).eq("id",id);
    if(error) throw error;
    return NextResponse.json({ok:true,status:"cancelled"});
  }catch(e:any){
    console.error("Reservation cancellation error:",e);
    return NextResponse.json({error:e?.message||"Could not cancel reservation."},{status:500});
  }
}
