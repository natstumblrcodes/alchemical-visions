import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
  }

  const { data: session, error: lookupError } = await supabase
    .from("communication_sessions")
    .select("*")
    .eq("id", sessionId)
    .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
    .in("status", ["accepted", "active"])
    .single();

  if (lookupError || !session) {
    return NextResponse.json({ error: "Active session not found." }, { status: 404 });
  }

  const endedAt = new Date();
  const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const { data: providerPricing } = await supabase
    .from("provider_profiles")
    .select("minimum_minutes")
    .eq("user_id", session.provider_id)
    .maybeSingle();
  const minimumMinutes = Math.max(1, Number(providerPricing?.minimum_minutes ?? 1));
  const billedMinutes = Math.max(minimumMinutes, Math.ceil(durationSeconds / 60));
  const subtotal = Math.round(billedMinutes * Number(session.price_per_minute) * 100) / 100;

  const { data: updated, error } = await supabase
    .from("communication_sessions")
    .update({
      status: "ended",
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      subtotal,
    })
    .eq("id", sessionId)
    .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
    .in("status", ["accepted", "active"])
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "Session was already ended." }, { status: 409 });
  }

  await supabase
    .from("session_events")
    .insert({
      session_id: sessionId,
      event_type: "ended",
      actor_id: user.id,
      payload: { durationSeconds, billedMinutes, subtotal },
    });

  return NextResponse.json({ session: updated });
}
