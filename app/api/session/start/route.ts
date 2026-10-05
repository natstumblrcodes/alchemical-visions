import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { providerId?: unknown; sessionType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const providerId = String(body.providerId ?? "");
  const sessionType = body.sessionType;

  if (!providerId || !["chat", "audio", "video"].includes(String(sessionType))) {
    return NextResponse.json({ error: "Invalid session request." }, { status: 400 });
  }

  if (providerId === user.id) {
    return NextResponse.json({ error: "A provider cannot start a session with themselves." }, { status: 400 });
  }

  const { data: provider, error: providerError } = await supabase
    .from("provider_profiles")
    .select("user_id,price_per_minute,minimum_minutes")
    .eq("user_id", providerId)
    .single();

  if (providerError || !provider) {
    return NextResponse.json({ error: "Provider unavailable." }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_online,accepting_sessions")
    .eq("id", provider.user_id)
    .single();

  if (profileError || !profile || profile.role !== "provider" || !profile.is_online || !profile.accepting_sessions) {
    return NextResponse.json({ error: "Provider is not currently accepting sessions." }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from("communication_sessions")
    .select("id,status")
    .eq("client_id", user.id)
    .eq("provider_id", provider.user_id)
    .in("status", ["pending", "accepted", "active"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `You already have a ${existing.status} session with this provider.`, session: existing }, { status: 409 });
  }

  const { data: session, error } = await supabase
    .from("communication_sessions")
    .insert({
      client_id: user.id,
      provider_id: provider.user_id,
      session_type: sessionType,
      status: "pending",
      price_per_minute: provider.price_per_minute,
    })
    .select("id,client_id,provider_id,session_type,status,price_per_minute,started_at,ended_at,duration_seconds,subtotal,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: eventError } = await supabase
    .from("session_events")
    .insert({ session_id: session.id, event_type: "requested", actor_id: user.id });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json({ session }, { status: 201 });
}
