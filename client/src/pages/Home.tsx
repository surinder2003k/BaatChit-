import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Moon, Paperclip, Send, Sun, Video, X, Zap } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type Message = { id: number; senderName: string; kind: "text" | "image" | "video"; body: string | null; mediaUrl: string | null; mediaName: string | null; createdAt: string };
type State = { session: { expiresAt: string }; messages: Message[] };

const NAME_KEY = "baatchit-name";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function formatTime(ms: number) {
  const safe = Math.max(0, ms);
  const h = Math.floor(safe / 3600000);
  const m = Math.floor((safe % 3600000) / 60000);
  const s = Math.floor((safe % 60000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [nameDraft, setNameDraft] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [countdown, setCountdown] = useState("24h 00m 00s");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const response = await fetch("/api/chat", { cache: "no-store" });
    if (!response.ok) throw new Error("Chat could not load");
    setState(await response.json());
  };

  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => {
    const stream = new EventSource("/api/chat/stream");
    stream.onmessage = () => load().catch(() => undefined);
    stream.onerror = () => undefined;
    return () => stream.close();
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!state) return;
      const remaining = new Date(state.session.expiresAt).getTime() - Date.now();
      setCountdown(formatTime(remaining));
      if (remaining <= 0) load().catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state?.session.expiresAt]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state?.messages.length]);

  const draftPreview = useMemo(() => file ? `${file.type.startsWith("video/") ? "Video" : "Photo"} ready · ${file.name}` : "", [file]);

  const saveName = (event: React.FormEvent) => {
    event.preventDefault();
    const value = nameDraft.trim().slice(0, 80);
    if (!value) return;
    localStorage.setItem(NAME_KEY, value);
    setName(value);
  };

  const send = async () => {
    if (!name || sending || (!text.trim() && !file)) return;
    setSending(true); setError("");
    try {
      let payload: Record<string, unknown> = { name, text: text.trim() };
      if (file) {
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
        payload.file = { name: file.name, type: file.type, data };
      }
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send");
      setText(""); setFile(null); if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send"); }
    finally { setSending(false); }
  };

  const onFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/") && !candidate.type.startsWith("video/")) { setError("Please choose a photo or video."); return; }
    if (candidate.size > MAX_FILE_BYTES) { setError("Files must be 25MB or smaller."); return; }
    setError(""); setFile(candidate);
  };

  return <main className="chat-app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /><span /></span><div><h1>BaatChit</h1><p>A room for right now.</p></div></div>
      <div className="top-actions"><div className="reset-chip"><span className="live-dot" /> <span>resets in</span> <strong>{countdown}</strong></div><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <section className="chat-window" aria-label="Chat messages">
      <div className="message-list">
        {!state?.messages.length && <div className="empty-state"><div className="empty-icon"><Zap size={20} /></div><h2>The room is quiet.</h2><p>Say hello — your message will appear here for everyone.</p></div>}
        {state?.messages.map(message => <article className={`message ${message.senderName === name ? "mine" : ""}`} key={message.id}>
          <div className="message-meta"><span className="avatar">{message.senderName.slice(0, 1).toUpperCase()}</span><strong>{message.senderName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <div className="bubble">{message.body && <p>{message.body}</p>}{message.kind === "image" && message.mediaUrl && <img src={message.mediaUrl} alt={message.mediaName ?? "Shared photo"} />}{message.kind === "video" && message.mediaUrl && <video src={message.mediaUrl} controls preload="metadata" />}</div>
        </article>)}
        <div ref={endRef} />
      </div>
      <div className="composer-wrap">
        {error && <div className="error-line">{error}</div>}
        {file && <div className="attachment-preview"><span>{file.type.startsWith("video/") ? <Video size={15} /> : <ImagePlus size={15} />}</span>{draftPreview}<button onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}><X size={14} /></button></div>}
        <div className="composer"><button className="attach-button" aria-label="Attach photo or video" onClick={() => inputRef.current?.click()}><Paperclip size={19} /><input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={event => onFile(event.target.files?.[0])} /></button><textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Write a message…" rows={1} /><button className="send-button" onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Send message"><Send size={18} /></button></div>
        <p className="composer-hint">Photos and videos up to 25MB · Enter to send</p>
      </div>
    </section>
    {!name && <div className="modal-backdrop"><form className="name-modal" onSubmit={saveName}><div className="modal-kicker"><span className="live-dot" /> OPEN ROOM</div><h2>What should we call you?</h2><p>Your name is saved only in this browser and shown beside your messages.</p><input autoFocus value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="Enter your name" maxLength={80} /><button type="submit" disabled={!nameDraft.trim()}>Enter the room <Send size={16} /></button></form></div>}
  </main>;
}
