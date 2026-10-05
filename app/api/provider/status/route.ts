import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { online, accepting } = await request.json();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["provider", "admin"].includes(profile.role)) return NextResponse.json({ error: "Provider access required." }, { status: 403 });

  const { error } = await supabase.from("profiles").update({
    is_online: Boolean(online),
    accepting_sessions: Boolean(accepting),
    last_seen_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
