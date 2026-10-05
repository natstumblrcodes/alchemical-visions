"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "chat" | "audio" | "video";

export default function SessionPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [provider, setProvider] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setUser(next));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    supabase.from("profiles").select("id,display_name,is_online,accepting_sessions").eq("role", "provider").limit(1).maybeSingle()
      .then(async ({ data, error }) => {
        if (error) return setError(error.message);
        if (!data) return setProvider(null);
        const { data: pricing } = await supabase.from("provider_profiles").select("price_per_minute").eq("user_id", data.id).maybeSingle();
        setProvider({ ...data, price_per_minute: Number(pricing?.price_per_minute ?? 2.99) });
      });
  }, [supabase]);

  useEffect(() => {
    if (!session?.started_at || session.status !== "active") {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session?.started_at]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel("session-" + session.id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "communication_sessions", filter: "id=eq." + session.id },
        payload => setSession(payload.new as typeof session))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, session?.id]);

  useEffect(() => {
    if (!session || session.status !== "active" || mode !== "chat" || !conversation) return;
    const channel = supabase.channel("conversation-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + conversation.id }, payload => {
        setMessages(current => current.some(m => m.id === payload.new.id) ? current : [...current, payload.new]);
      }).subscribe();
    supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));
    return () => { supabase.removeChannel(channel); };
  }, [supabase, session, mode, conversation]);

  const clock = (seconds: number) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return h + ":" + m + ":" + s;
  };

  async function signIn() {
    setBusy(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message); else setUser(data.user);
    setBusy(false);
  }

  async function signUp() {
    setBusy(true); setError("");
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) setError(error.message); else if (data.user) setUser(data.user);
    setBusy(false);
  }

  async function begin() {
    if (!user) return setError("Sign in before starting a session.");
    if (!provider?.is_online || !provider?.accepting_sessions) return setError("Natalie is not accepting sessions right now.");
    setBusy(true); setError("");
    const response = await fetch("/api/session/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: provider.id, sessionType: mode }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to start session.");
    else {
      setSession(result.session);
      if (mode === "chat") {
        const { data } = await supabase.from("conversations").select("*").eq("client_id", user.id).eq("provider_id", provider.id).maybeSingle();
        if (data) setConversation(data);
        else {
          const created = await supabase.from("conversations").insert({ client_id: user.id, provider_id: provider.id }).select("*").single();
          if (created.error) setError(created.error.message); else setConversation(created.data);
        }
      }
    }
    setBusy(false);
  }

  async function sendMessage() {
    if (!message.trim() || !conversation) return;
    const response = await fetch("/api/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conversation.id, body: message.trim() }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Message failed."); else { setMessages(current => [...current, result.message]); setMessage(""); }
  }

  async function endSession() {
    if (!session) return;
    setBusy(true);
    const response = await fetch("/api/session/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to end session."); else setSession(result.session);
    setBusy(false);
  }

  if (!user) return <main className="app-shell narrow"><header className="header"><div className="brand-mark">☾<span>✦</span></div><div className="brand">ALCHEMICAL<br/><b>VISIONS</b></div></header><section className="form-card"><h1>Private Consultation</h1><p>Sign in to begin a live session.</p><label className="field"><span>✉</span><input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address"/></label><label className="field"><span>▣</span><input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password"/></label><label className="field"><span>♙</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name for new accounts"/></label><button className="gold-button" disabled={busy} onClick={signIn}>✦ Sign In ✦</button><button className="light-button" disabled={busy} onClick={signUp}>Create Account</button>{error && <p role="alert">{error}</p>}</section></main>;

  const price = Number(provider?.price_per_minute ?? 2.99);
  const total = Math.round((elapsed / 60) * price * 100) / 100;

  return <main className="app-shell"><header className="header"><div className="brand-mark">☾<span>✦</span></div><div className="brand">ALCHEMICAL<br/><b>VISIONS</b></div><div className="status"><span className={provider?.is_online ? "dot online" : "dot"}/>{provider?.is_online ? "Online" : "Offline"}</div><div className="balance"><strong>${total.toFixed(2)}</strong><span>{clock(elapsed)}</span><small>Current Session</small></div></header><div className="tabs"><button className={mode==="chat" ? "tab active" : "tab"} onClick={() => setMode("chat")}>▤ Text Chat</button><button className={mode==="video" ? "tab active" : "tab"} onClick={() => setMode("video")}>◼ Video Chat</button><button className={mode==="audio" ? "tab active" : "tab"} onClick={() => setMode("audio")}>☎ Audio Call</button></div><section className="main-panel"><div className="chat-window">{!session && <><h2>Live Consultation</h2><p>{provider?.is_online && provider?.accepting_sessions ? "Natalie is available." : "Natalie is currently unavailable."}</p><p>Rate: <strong>${price.toFixed(2)} per minute</strong></p><button className="gold-button" disabled={busy || !provider?.is_online || !provider?.accepting_sessions} onClick={begin}>✦ Begin {mode === "chat" ? "Chat" : mode === "audio" ? "Audio Call" : "Video Call"} ✦</button></>}{session?.status === "pending" && <div className="sky"><div className="stars">✦ · ☾ · ✦</div><div className="wait">✧</div><h2>Waiting for your reader</h2><p>Your request has been sent. The session timer will begin only after it is accepted.</p><button className="light-button" disabled={busy} onClick={async () => { setBusy(true); const response = await fetch("/api/session/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id }) }); const result = await response.json(); if (!response.ok) setError(result.error ?? "Unable to cancel request."); else { setSession(null); setConversation(null); } setBusy(false); }}>Cancel Request</button></div>}
        {session?.status === "active" && <>{mode !== "chat" && <div className="call-panel"><div className={mode === "audio" ? "phone-orb" : "video-avatar"}>{mode === "audio" ? "☎" : "●"}</div><div className="call-status">{session.status === "ended" ? "Session Ended" : "Connected Session"}</div><div className="timer">{clock(elapsed)}</div></div>}{mode === "chat" && <div>{messages.map(m => <p key={m.id}><b>{m.sender_id === user.id ? "You" : "Natalie"}:</b> {m.body}</p>)}</div>}{session && ["accepted","active"].includes(session.status) && <button className="end-call" disabled={busy} onClick={endSession}>☎ End Session</button>}{session?.status === "ended" && <p><strong>Final session total: ${Number(session.subtotal).toFixed(2)}</strong></p>}</>}</div>{session?.status === "active" && mode === "chat" && <div className="message-row"><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMessage(); }} placeholder="Type a message..."/><button className="round" onClick={sendMessage}>➤</button></div>}</section>{error && <p role="alert">{error}</p>}</main>;
}
