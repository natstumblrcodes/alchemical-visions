import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase.from("provider_notification_settings")
    .select("phone_e164,sms_enabled,voice_enabled").eq("provider_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? { phone_e164: "", sms_enabled: true, voice_enabled: true } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["provider", "admin"].includes(profile.role)) return NextResponse.json({ error: "Provider access required." }, { status: 403 });

  const body = await request.json();
  const phone = String(body.phoneE164 ?? "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return NextResponse.json({ error: "Enter a valid phone number in E.164 format, such as +15551234567." }, { status: 400 });

  const { data, error } = await supabase.from("provider_notification_settings").upsert({
    provider_id: user.id, phone_e164: phone,
    sms_enabled: body.smsEnabled !== false, voice_enabled: body.voiceEnabled !== false,
    updated_at: new Date().toISOString()
  }).select("phone_e164,sms_enabled,voice_enabled").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
