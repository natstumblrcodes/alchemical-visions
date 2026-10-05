import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callForSession, sendSessionSms } from "@/lib/twilio";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) return NextResponse.json({ error: "Session ID required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin.from("communication_sessions")
    .select("id,client_id,provider_id,session_type,status").eq("id", sessionId).single();
  if (!session || session.client_id !== user.id || session.status !== "pending")
    return NextResponse.json({ error: "Session notification not authorized." }, { status: 403 });

  const { data: settings } = await admin.from("provider_notification_settings")
    .select("phone_e164,sms_enabled,voice_enabled").eq("provider_id", session.provider_id).maybeSingle();

  if (!settings?.phone_e164) return NextResponse.json({ sent: false, reason: "Provider phone is not configured." });

  const results: string[] = [];
  if (settings.sms_enabled) {
    try { await sendSessionSms(settings.phone_e164, session.session_type); results.push("sms"); } catch {}
  }
  if (settings.voice_enabled) {
    try { await callForSession(settings.phone_e164, session.session_type); results.push("voice"); } catch {}
  }
  return NextResponse.json({ sent: results.length > 0, channels: results });
}
