import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getAuthUser } from "@/lib/server";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error:"Unauthorized." }, { status:401 });
  const supabase = getAdminSupabase();
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !profile) return NextResponse.json({ error:"Profile not found." }, { status:404 });
  const { data: perms } = await supabase.from("equipment_permissions").select("equipment").eq("user_id", user.id).eq("allowed", true);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return NextResponse.json({
    id:user.id, email:profile.email, name:profile.name, supervisor:profile.supervisor, status:profile.status,
    isAdmin:user.email?.toLowerCase() === adminEmail,
    permissions:(perms||[]).map(p=>p.equipment)
  });
}
