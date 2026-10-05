import { createAdminClient } from "@/lib/supabase/admin";
import { callForSession, sendSessionSms } from "@/lib/twilio";

export async function notifyProviderOfSession(sessionId: string) {
  const admin = createAdminClient();
  const { data: session } = await admin.from("communication_sessions")
    .select("id,client_id,provider_id,session_type,status").eq("id", sessionId).single();
  if (!session || session.status !== "pending") return { sent: false, channels: [] as string[] };

  const { data: settings } = await admin.from("provider_notification_settings")
    .select("phone_e164,sms_enabled,voice_enabled").eq("provider_id", session.provider_id).maybeSingle();

  const channels: string[] = [];
  if (settings?.phone_e164) {
    if (settings.sms_enabled) {
      try { await sendSessionSms(settings.phone_e164, session.session_type); channels.push("sms"); } catch {}
    }
    if (settings.voice_enabled) {
      try { await callForSession(settings.phone_e164, session.session_type); channels.push("voice"); } catch {}
    }
  }

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
    try {
      const webpush = (await import("web-push")).default;
      webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      const { data: subscriptions } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("provider_id", session.provider_id);
      for (const sub of subscriptions ?? []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
            title: "Alchemical Visions",
            body: "New " + session.session_type + " consultation request.",
            url: "/provider"
          }));
          channels.push("push");
        } catch {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    } catch {}
  }

  return { sent: channels.length > 0, channels };
}
