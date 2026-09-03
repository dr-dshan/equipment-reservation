import { NextRequest, NextResponse } from "next/server";
import { EQUIPMENT } from "@/lib/equipment";
import { getAdminSupabase, requireAdmin } from "@/lib/server";

export async function PATCH(req:NextRequest, context:{params:Promise<{userId:string}>}){
  try{
    await requireAdmin(req);
    const { userId } = await context.params;
    const body = await req.json();
    const supabase=getAdminSupabase();

    if(body.status){
      if(!["pending","approved","rejected"].includes(body.status)) return NextResponse.json({error:"Invalid status."},{status:400});
      const { error } = await supabase.from("profiles").update({status:body.status}).eq("id",userId);
      if(error) throw error;
    }

    if(Array.isArray(body.permissions)){
      for(const eq of EQUIPMENT){
        const allowed = body.permissions.includes(eq);
        const { error } = await supabase.from("equipment_permissions").upsert({user_id:userId,equipment:eq,allowed},{onConflict:"user_id,equipment"});
        if(error) throw error;
      }
    }
    return NextResponse.json({ok:true});
  }catch(e:any){
    return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":"Could not update user."},{status:e.message==="ADMIN_REQUIRED"?403:500});
  }
}
