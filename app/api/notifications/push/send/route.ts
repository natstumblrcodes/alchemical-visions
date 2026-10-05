import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  const sessionId = String(body.sessionId ?? "");
  const admin = createAdminClient();
  const { data: session } = await admin.from("communication_sessions").select("id,client_id,provider_id,status,session_type").eq("id", sessionId).single();
  if (!session || session.client_id !== user.id || session.status !== "pending") return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  return NextResponse.json({ sent: false, reason: "Push delivery is configured per provider device." });
}
