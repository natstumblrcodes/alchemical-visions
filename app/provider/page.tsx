"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RequestItem = { id: string; client_id: string; session_type: "chat" | "audio" | "video"; price_per_minute: number; created_at: string };

export default function ProviderPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [online, setOnline] = useState(false), [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [phone, setPhone] = useState(""), [smsEnabled, setSmsEnabled] = useState(true), [voiceEnabled, setVoiceEnabled] = useState(true), [pushReady, setPushReady] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUser({ id: data.user.id }); }); }, [supabase]);

  async function load() {
    if (!user) return;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_online,accepting_sessions").eq("id", user.id).single();
    if (profileError) return setError(profileError.message);
    if (!["provider", "admin"].includes(profile.role)) return setError("Provider access required.");
    setOnline(profile.is_online); setAccepting(profile.accepting_sessions);
    const { data, error: requestError } = await supabase.from("communication_sessions").select("id,client_id,session_type,price_per_minute,created_at").eq("provider_id", user.id).eq("status", "pending").order("created_at", { ascending: true });
    if (requestError) setError(requestError.message); else setRequests(data ?? []);
    const settings = await fetch("/api/notifications/settings");
    if (settings.ok) { const result = await settings.json(); setPhone(result.settings.phone_e164 ?? ""); setSmsEnabled(result.settings.sms_enabled !== false); setVoiceEnabled(result.settings.voice_enabled !== false); }
  }

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("provider-session-requests").on("postgres_changes", { event: "*", schema: "public", table: "communication_sessions", filter: "provider_id=eq." + user.id }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, user]);

  async function setStatus(nextOnline: boolean, nextAccepting: boolean) {
    setBusy(true); setError("");
    const response = await fetch("/api/provider/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ online: nextOnline, accepting: nextAccepting }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to update status."); else { setOnline(nextOnline); setAccepting(nextAccepting); }
    setBusy(false);
  }

  async function saveNotifications() {
    setBusy(true); setError("");
    const response = await fetch("/api/notifications/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneE164: phone, smsEnabled, voiceEnabled }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save notification settings."); else setPhone(result.settings.phone_e164);
    setBusy(false);
  }

  async function enablePush() {
    setBusy(true); setError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push notifications are not supported by this browser.");
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error("Push notifications are not configured yet.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) });
      const response = await fetch("/api/notifications/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to register this phone.");
      setPushReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to enable push notifications."); }
    setBusy(false);
  }

  async function accept(id: string) {
    setBusy(true); setError("");
    const response = await fetch("/api/session/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to accept request.");
    await load(); setBusy(false);
  }

  if (!user) return <main className="app-shell narrow"><section className="form-card"><h1>Provider Console</h1><p>Sign in through Supabase to manage consultation requests.</p></section></main>;

  return <main className="app-shell narrow"><header className="header"><div className="brand-mark">☾<span>✦</span></div><div className="brand">ALCHEMICAL<br/><b>VISIONS</b></div></header><section className="form-card"><h1>Provider Console</h1><p>Control availability and receive incoming consultation alerts.</p><div className="tabs"><button className={online ? "tab active" : "tab"} disabled={busy} onClick={() => setStatus(!online, !online ? false : accepting)}>● {online ? "Online" : "Go Online"}</button><button className={accepting ? "tab active" : "tab"} disabled={busy || !online} onClick={() => setStatus(online, !accepting)}>✦ {accepting ? "Accepting" : "Not Accepting"}</button></div><h2>Phone Alerts</h2><p>Use E.164 format, for example +15551234567.</p><label className="field"><span>☎</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+15551234567" inputMode="tel"/></label><label><input type="checkbox" checked={smsEnabled} onChange={e => setSmsEnabled(e.target.checked)}/> SMS alert</label><br/><label><input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)}/> Voice call alert</label><button className="gold-button" disabled={busy} onClick={saveNotifications}>Save Phone Alerts</button><button className="light-button" disabled={busy || pushReady} onClick={enablePush}>{pushReady ? "✓ Push Enabled" : "Enable Push on This Phone"}</button><h2>Pending Requests</h2>{requests.length === 0 && <p>No pending requests.</p>}{requests.map(item => <div key={item.id} className="field" style={{ display: "block", padding: 14 }}><strong>{item.session_type.toUpperCase()} consultation</strong><br/><small>Client: {item.client_id}<br/>Rate: ${Number(item.price_per_minute).toFixed(2)}/minute</small><button className="gold-button" disabled={busy || !online || !accepting} onClick={() => accept(item.id)}>✦ Accept Session ✦</button></div>)}{error && <p role="alert">{error}</p>}<button className="text-link" onClick={() => supabase.auth.signOut()}>Sign out</button></section></main>;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}
