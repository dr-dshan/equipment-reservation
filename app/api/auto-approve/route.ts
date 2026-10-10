import {NextRequest,NextResponse} from "next/server";
import {cronAuthorized,getAdminSupabase,sendReservationResultEmail} from "@/lib/server";

export async function GET(req:NextRequest){return run(req)}
export async function POST(req:NextRequest){return run(req)}

async function run(req:NextRequest){
  if(!cronAuthorized(req)) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const supabase=getAdminSupabase(), now=new Date().toISOString();
    const {data:list,error}=await supabase.from("reservations").select("*").eq("status","pending").lte("auto_approve_at",now).order("auto_approve_at").limit(100);
    if(error) throw error;
    let approved=0,declined=0;
    for(const r of list||[]){
      const [{data:conflicts,error:conflictError},{data:blocks,error:blockError}]=await Promise.all([
        supabase.from("reservations").select("id").eq("equipment",r.equipment).eq("status","approved").neq("id",r.id).lt("start_time",r.end_time).gt("end_time",r.start_time),
        supabase.from("maintenance_blocks").select("id,title").eq("equipment",r.equipment).lt("start_time",r.end_time).gt("end_time",r.start_time)
      ]);
      if(conflictError) throw conflictError;if(blockError) throw blockError;
      const blocked=(blocks||[]).length>0,hasConflict=(conflicts||[]).length>0;
      const status=blocked||hasConflict?"declined":"approved";
      const reason=blocked?"The time is blocked for maintenance.":hasConflict?"The time conflicts with another approved reservation.":undefined;
      const {data:updated,error:updateError}=await supabase.from("reservations").update({status,approval_token_hash:null,reviewed_at:now,auto_processed_at:now}).eq("id",r.id).eq("status","pending").select("id").maybeSingle();
      if(updateError) throw updateError;if(!updated) continue;
      if(status==="approved") approved++; else declined++;
      try{await sendReservationResultEmail(r,status,reason)}catch(emailError){console.error(emailError)}
    }
    return NextResponse.json({ok:true,checked:list?.length||0,approved,declined});
  }catch(e){console.error(e);return NextResponse.json({error:"Automatic approval failed."},{status:500})}
}
