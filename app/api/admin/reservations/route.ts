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
