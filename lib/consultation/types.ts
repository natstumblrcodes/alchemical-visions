export type SessionType = "chat" | "audio" | "video";
export type SessionStatus = "pending" | "accepted" | "active" | "ended" | "cancelled" | "payment_failed";
export type ConsultationSession = {
  id: string;
  client_id: string;
  provider_id: string;
  session_type: SessionType;
  status: SessionStatus;
  price_per_minute: number;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  subtotal: number;
};
