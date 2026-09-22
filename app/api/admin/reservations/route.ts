import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, requireAdmin } from "@/lib/server";

export async function GET(req:NextRequest){
  try{
    await requireAdmin(req);
    const supabase=getAdminSupabase();
    const { data, error } = await supabase.from("reservations").select("*").order("start_time",{ascending:false}).limit(100);
    if(error) throw error;
    return NextResponse.json({reservations:data||[]});
  }catch(e:any){
    return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":"Could not load reservations."},{status:e.message==="ADMIN_REQUIRED"?403:500});
  }
}


export async function PATCH(req:NextRequest){
  try{
    await requireAdmin(req);
    const { id, action }=await req.json();
    if(!id || !["approve","decline"].includes(action))
      return NextResponse.json({error:"Invalid request."},{status:400});

    const supabase=getAdminSupabase();
    const {data:r,error:readError}=await supabase.from("reservations").select("*").eq("id",id).maybeSingle();
    if(readError) throw readError;
    if(!r) return NextResponse.json({error:"Reservation not found."},{status:404});
    if(r.status!=="pending") return NextResponse.json({error:`Reservation is already ${r.status}.`},{status:409});

    if(action==="approve"){
      const {data:conflicts,error:conflictError}=await supabase.from("reservations").select("id")
        .eq("equipment",r.equipment).eq("status","approved").neq("id",r.id)
        .lt("start_time",r.end_time).gt("end_time",r.start_time);
      if(conflictError) throw conflictError;
      if((conflicts||[]).length)
        return NextResponse.json({error:"Another approved reservation overlaps with this request."},{status:409});
    }

    const status=action==="approve"?"approved":"declined";
    const {error:updateError}=await supabase.from("reservations").update({
      status,approval_token_hash:null,reviewed_at:new Date().toISOString()
    }).eq("id",id);
    if(updateError) throw updateError;

    // Notify requester, but do not undo the admin decision if email delivery fails.
    try{
      const {Resend}=await import("resend");
      const resend=new Resend(process.env.RESEND_API_KEY);
      const from=process.env.RESEND_FROM;
      if(from && r.email){
        const {error}=await resend.emails.send({
          from,to:r.email,
          subject:`Equipment reservation ${status}: ${r.equipment}`,
          html:`<p>Hello ${r.name},</p><p>Your <b>${r.equipment}</b> reservation has been <b>${status}</b>.</p>`
        });
        if(error) console.error("Requester result email failed:",error);
      }
    }catch(e){console.error("Requester result email failed:",e)}

    return NextResponse.json({ok:true,status});
  }catch(e:any){
    console.error("Admin reservation update error:",e);
    return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":(e.message||"Could not update reservation.")},
      {status:e.message==="ADMIN_REQUIRED"?403:500});
  }
}
