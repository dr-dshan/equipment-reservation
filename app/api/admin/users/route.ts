import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, requireAdmin } from "@/lib/server";

export async function GET(req:NextRequest){
  try{
    await requireAdmin(req);
    const supabase=getAdminSupabase();
    const { data:profiles, error } = await supabase.from("profiles").select("*").order("created_at",{ascending:false});
    if(error) throw error;
    const { data:perms } = await supabase.from("equipment_permissions").select("*");
    const users=(profiles||[]).map(p=>({...p, permissions:(perms||[]).filter(x=>x.user_id===p.id && x.allowed).map(x=>x.equipment)}));
    return NextResponse.json({users});
  }catch(e:any){
    return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":"Could not load users."},{status:e.message==="ADMIN_REQUIRED"?403:500});
  }
}
