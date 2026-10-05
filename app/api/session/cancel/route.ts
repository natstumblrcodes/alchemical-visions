import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: { sessionId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) return NextResponse.json({ error: "Session ID is required." }, { status: 400 });

  const { data: updated, error } = await supabase
    .from("communication_sessions")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("client_id", user.id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Pending session not found." }, { status: 404 });

  await supabase.from("session_events").insert({ session_id: sessionId, event_type: "cancelled", actor_id: user.id });
  return NextResponse.json({ session: updated });
}
