import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth)
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").upsert({
    provider_id: user.id,
    endpoint: String(body.endpoint),
    p256dh: String(body.keys.p256dh),
    auth: String(body.keys.auth),
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider_id,endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
