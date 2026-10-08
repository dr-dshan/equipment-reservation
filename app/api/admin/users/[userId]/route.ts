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

export async function POST(req:NextRequest,context:{params:Promise<{userId:string}>}){
 try {await requireAdmin(req);const {userId}=await context.params;const supabase=getAdminSupabase();
 const {data:profile,error}=await supabase.from("profiles").select("email").eq("id",userId).single();
 if(error||!profile)return NextResponse.json({error:"User not found."},{status:404});
 const site=process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,"");
 if(!site)return NextResponse.json({error:"NEXT_PUBLIC_SITE_URL is not configured."},{status:500});
 const {data,error:linkError}=await supabase.auth.admin.generateLink({type:"recovery",email:profile.email,options:{redirectTo:`${site}/reset-password`}});
 if(linkError||!data?.properties?.action_link)return NextResponse.json({error:linkError?.message||"Could not generate reset link."},{status:500});
 const {Resend}=await import("resend");
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return NextResponse.json({error:"Email sender is not configured."},{status:500});
 const {error:sendError}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM,to:profile.email,subject:"Equipment Reservation - Reset your password",html:`<p>A password reset was requested for your Equipment Reservation account.</p><p><a href="${data.properties.action_link}">Reset password</a></p><p>If you did not request this, please ignore this email.</p>`});
 if(sendError)return NextResponse.json({error:sendError.message},{status:500});
 return NextResponse.json({ok:true});
 }catch(e:any){return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":(e.message||"Reset failed.")},{status:e.message==="ADMIN_REQUIRED"?403:500});}
}
export async function DELETE(req:NextRequest,context:{params:Promise<{userId:string}>}){
 try {const admin=await requireAdmin(req);const {userId}=await context.params;
 if(admin.id===userId)return NextResponse.json({error:"You cannot delete your own administrator account."},{status:400});
 const supabase=getAdminSupabase();
 const {data:active,error:activeError}=await supabase.from("reservations").select("id").eq("user_id",userId).in("status",["pending","approved"]).limit(1);
 if(activeError)throw activeError;
 if(active?.length)return NextResponse.json({error:"This user has active reservations. Cancel them first to preserve the schedule."},{status:409});
 // Existing schema uses ON DELETE CASCADE for reservations: prevent accidental history loss.
 const {data:history,error:historyError}=await supabase.from("reservations").select("id").eq("user_id",userId).limit(1);
 if(historyError)throw historyError;
 if(history?.length)return NextResponse.json({error:"This user has reservation history. Deletion is blocked to protect records. Use Reject to disable access, or migrate the history before deletion."},{status:409});
 const {error}=await supabase.auth.admin.deleteUser(userId);
 if(error)throw error;
 return NextResponse.json({ok:true});
 }catch(e:any){return NextResponse.json({error:e.message==="ADMIN_REQUIRED"?"Admin access required.":(e.message||"Delete failed.")},{status:e.message==="ADMIN_REQUIRED"?403:500});}
}
