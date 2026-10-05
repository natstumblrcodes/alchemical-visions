import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  const providerId = String(body.providerId ?? "");
  const sessionType = body.sessionType;
  if (!providerId || !["chat", "audio", "video"].includes(sessionType)) return NextResponse.json({ error: "Invalid session request." }, { status: 400 });

  const { data: provider } = await supabase.from("provider_profiles").select("user_id,price_per_minute,minimum_minutes").eq("user_id", providerId).single();
  if (!provider) return NextResponse.json({ error: "Provider unavailable." }, { status: 404 });

  const { data: session, error } = await supabase.from("communication_sessions").insert({
    client_id: user.id, provider_id: provider.user_id, session_type: sessionType, status: "pending", price_per_minute: provider.price_per_minute,
  }).select("id,client_id,provider_id,session_type,status,price_per_minute,started_at,ended_at,duration_seconds,subtotal").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("session_events").insert({ session_id: session.id, event_type: "requested", actor_id: user.id });
  return NextResponse.json({ session });
}
