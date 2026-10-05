import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { sessionId } = await request.json();
  const { data: session } = await supabase.from("communication_sessions").select("*").or("client_id.eq."+user.id+",provider_id.eq."+user.id).in("status", ["active","accepted"]).single();
  if (!session || session.id !== sessionId) return NextResponse.json({ error: "Active session not found." }, { status: 404 });

  const endedAt = new Date();
  const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const subtotal = Math.round((durationSeconds / 60) * Number(session.price_per_minute) * 100) / 100;

  const { data: updated, error } = await supabase.from("communication_sessions").update({
    status: "ended", ended_at: endedAt.toISOString(), duration_seconds: durationSeconds, subtotal,
  }).eq("id", sessionId).in("status", ["active","accepted"]).select("*").single();
  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Session was already ended." }, { status: 409 });
  await supabase.from("session_events").insert({ session_id: sessionId, event_type: "ended", actor_id: user.id, payload: { durationSeconds, subtotal } });
  return NextResponse.json({ session: updated });
}
