import { NextRequest, NextResponse } from "next/server";
import { EQUIPMENT, isEquipment } from "@/lib/equipment";
import { getAdminSupabase, requireAdmin } from "@/lib/server";

export async function PATCH(req:NextRequest, context:{params:Promise<{userId:string}>}){
  try{
    await requireAdmin(req);
    const { userId } = await context.params;
    const body = await req.json();
    const supabase=getAdminSupabase();

    if(body.status){
      if(!["pending","approved","rejected"].includes(body.status))
        return NextResponse.json({error:"Invalid status."},{status:400});
      const { error }=await supabase.from("profiles").update({status:body.status}).eq("id",userId);
      if(error) return NextResponse.json({error:`Profile update failed: ${error.message}`},{status:500});
    }

    // Preferred path: change only the checkbox that was clicked.
    if(body.permission && typeof body.permission==="object"){
      const { equipment, allowed }=body.permission;
      if(!isEquipment(equipment) || typeof allowed!=="boolean")
        return NextResponse.json({error:"Invalid equipment permission."},{status:400});

      const { error }=await supabase.from("equipment_permissions").upsert(
        {user_id:userId,equipment,allowed},
        {onConflict:"user_id,equipment"}
      );
      if(error)
        return NextResponse.json({
          error:`Permission save failed for ${equipment}: ${error.message}`,
          code:error.code,
          details:error.details
        },{status:500});

      return NextResponse.json({ok:true,equipment,allowed});
    }

    // Backward compatibility with older clients.
    if(Array.isArray(body.permissions)){
      for(const eq of EQUIPMENT){
        const allowed=body.permissions.includes(eq);
        const { error }=await supabase.from("equipment_permissions").upsert(
          {user_id:userId,equipment:eq,allowed},
          {onConflict:"user_id,equipment"}
        );
        if(error)
          return NextResponse.json({
            error:`Permission save failed for ${eq}: ${error.message}`,
            code:error.code,
            details:error.details
          },{status:500});
      }
    }
    return NextResponse.json({ok:true});
  }catch(e:any){
    console.error("Admin user update error:",e);
    return NextResponse.json(
      {error:e.message==="ADMIN_REQUIRED"?"Admin access required.":(e.message||"Could not update user.")},
      {status:e.message==="ADMIN_REQUIRED"?403:500}
    );
  }
}
