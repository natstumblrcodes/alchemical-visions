import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalType = "offer" | "answer" | "ice";

export async function sendSignal(
  supabase: SupabaseClient,
  sessionId: string,
  senderId: string,
  signalType: SignalType,
  payload: unknown
) {
  return supabase.from("webrtc_signals").insert({
    session_id: sessionId,
    sender_id: senderId,
    signal_type: signalType,
    payload,
  });
}

export function subscribeToSignals(
  supabase: SupabaseClient,
  sessionId: string,
  onSignal: (signal: { sender_id: string; signal_type: SignalType; payload: any }) => void
) {
  const channel = supabase
    .channel("webrtc-" + sessionId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "webrtc_signals", filter: "session_id=eq." + sessionId },
      (event) => onSignal(event.new as any)
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
