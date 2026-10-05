"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RequestItem = { id: string; client_id: string; session_type: "chat" | "audio" | "video"; price_per_minute: number; created_at: string };

export default function ProviderPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [online, setOnline] = useState(false); const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUser({ id: data.user.id }); }); }, [supabase]);

  async function load() {
    if (!user) return;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_online,accepting_sessions").eq("id", user.id).single();
    if (profileError) return setError(profileError.message);
    if (!["provider", "admin"].includes(profile.role)) return setError("Provider access required.");
    setOnline(profile.is_online); setAccepting(profile.accepting_sessions);
    const { data, error: requestError } = await supabase.from("communication_sessions").select("id,client_id,session_type,price_per_minute,created_at").eq("provider_id", user.id).eq("status", "pending").order("created_at", { ascending: true });
    if (requestError) setError(requestError.message); else setRequests(data ?? []);
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

  async function accept(id: string) {
    setBusy(true); setError("");
    const response = await fetch("/api/session/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to accept request.");
    await load(); setBusy(false);
  }

  if (!user) return <main className="app-shell narrow"><section className="form-card"><h1>Provider Console</h1><p>Sign in through Supabase to manage consultation requests.</p></section></main>;

  return <main className="app-shell narrow"><header className="header"><div className="brand-mark">☾<span>✦</span></div><div className="brand">ALCHEMICAL<br/><b>VISIONS</b></div></header><section className="form-card"><h1>Provider Console</h1><p>Control availability and accept incoming consultation requests.</p><div className="tabs"><button className={online ? "tab active" : "tab"} disabled={busy} onClick={() => setStatus(!online, accepting)}>● {online ? "Online" : "Go Online"}</button><button className={accepting ? "tab active" : "tab"} disabled={busy || !online} onClick={() => setStatus(online, !accepting)}>✦ {accepting ? "Accepting" : "Not Accepting"}</button></div><h2>Pending Requests</h2>{requests.length === 0 && <p>No pending requests.</p>}{requests.map((item) => <div key={item.id} className="field" style={{ display: "block", padding: 14 }}><strong>{item.session_type.toUpperCase()} consultation</strong><br /><small>Client: {item.client_id}<br />Rate: {"$"}{Number(item.price_per_minute).toFixed(2)}/minute</small><button className="gold-button" disabled={busy || !online || !accepting} onClick={() => accept(item.id)}>✦ Accept Session ✦</button></div>)}{error && <p role="alert">{error}</p>}<button className="text-link" onClick={() => supabase.auth.signOut()}>Sign out</button></section></main>;
}
