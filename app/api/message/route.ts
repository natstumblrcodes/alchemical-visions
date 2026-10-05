import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { conversationId?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const conversationId = String(body.conversationId ?? "");
  const messageBody = String(body.body ?? "").trim();

  if (!conversationId || !messageBody || messageBody.length > 10000) {
    return NextResponse.json({ error: "A message between 1 and 10,000 characters is required." }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, client_id, provider_id")
    .eq("id", conversationId)
    .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const { data: activeSession, error: sessionError } = await supabase
    .from("communication_sessions")
    .select("id")
    .eq("client_id", conversation.client_id)
    .eq("provider_id", conversation.provider_id)
    .eq("session_type", "chat")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!activeSession) {
    return NextResponse.json({ error: "No active chat session." }, { status: 409 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: messageBody,
    })
    .select("id,conversation_id,sender_id,body,created_at,read_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message }, { status: 201 });
}
