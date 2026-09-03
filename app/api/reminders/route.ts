import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, formatSeoulRange, getAdminSupabase } from "@/lib/server";

export async function POST(req:NextRequest){ return run(req); }
export async function GET(req:NextRequest){ return run(req); }

async function run(req:NextRequest){
  try{
    const supplied = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
    if(!process.env.CRON_SECRET || supplied !== process.env.CRON_SECRET) return NextResponse.json({error:"Unauthorized."},{status:401});
    const key=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM; if(!key||!from) throw new Error("Email env missing.");
    const now=new Date(), lower=new Date(now.getTime()+4*60000), upper=new Date(now.getTime()+6*60000);
    const supabase=getAdminSupabase();
    const { data:list, error } = await supabase.from("reservations").select("*").eq("status","approved").is("reminder_sent_at",null).gte("start_time",lower.toISOString()).lte("start_time",upper.toISOString());
    if(error) throw error;
    const resend=new Resend(key); let sent=0;
    for(const r of list||[]){
      const range=formatSeoulRange(r.start_time,r.end_time);
      const out=await resend.emails.send({ from, to:r.email, subject:`${r.equipment} Reservation Reminder`,
        html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827"><div style="font-size:12px;letter-spacing:.14em;color:#6b7280">EQUIPMENT RESERVATION</div><h1 style="font-family:Georgia,serif;font-weight:400">Your reservation starts in 5 minutes</h1><p><b>Equipment:</b> ${escapeHtml(r.equipment)}</p><p><b>Start:</b> ${escapeHtml(range.start)}</p><p><b>End:</b> ${escapeHtml(range.end)}</p><p><b>Purpose:</b> ${escapeHtml(r.purpose)}</p></div>` });
      if(!out.error){ await supabase.from("reservations").update({ reminder_sent_at:new Date().toISOString() }).eq("id",r.id).is("reminder_sent_at",null); sent++; }
    }
    return NextResponse.json({ok:true,checked:list?.length||0,sent});
  }catch(e){ console.error(e); return NextResponse.json({error:"Reminder failed."},{status:500}); }
}
