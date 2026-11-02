import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ImagePlus, MessageCircleReply, Moon, Paperclip, Send, Smile, Sun, Video, X, Zap } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type Message = { id: number; senderName: string; kind: "text" | "image" | "video"; body: string | null; mediaUrl: string | null; mediaName: string | null; createdAt: string; replyToId?: number | null; replyToSender?: string | null; replyToBody?: string | null; reactions?: Record<string, number> };
type State = { session: { expiresAt: string }; messages: Message[] };
type Attachment = { file: File; preview: string };
type Reply = { id: number; senderName: string; body: string };

const NAME_KEY = "baatchit-name";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const EMOJIS = ["😀", "😂", "😍", "👍", "❤️", "🔥", "🎉", "😮", "😢", "🙏"];

function formatTime(ms: number) {
  const safe = Math.max(0, ms); const h = Math.floor(safe / 3600000); const m = Math.floor((safe % 3600000) / 60000); const s = Math.floor((safe % 60000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [nameDraft, setNameDraft] = useState(""); const [text, setText] = useState(""); const [state, setState] = useState<State | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]); const [lightboxIndex, setLightboxIndex] = useState<number | null>(null); const [zoom, setZoom] = useState(1);
  const [reply, setReply] = useState<Reply | null>(null); const [menuMessage, setMenuMessage] = useState<number | null>(null); const [emojiOpen, setEmojiOpen] = useState(false);
  const [countdown, setCountdown] = useState("24h 00m 00s"); const [sending, setSending] = useState(false); const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null); const touchStart = useRef<{ id: number; x: number } | null>(null); const pressTimer = useRef<number | null>(null);

  const load = async () => { const response = await fetch("/api/chat", { cache: "no-store" }); if (!response.ok) throw new Error("Chat could not load"); setState(await response.json()); };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => { const stream = new EventSource("/api/chat/stream"); stream.onmessage = () => load().catch(() => undefined); stream.onerror = () => undefined; return () => stream.close(); }, []);
  useEffect(() => { const timer = window.setInterval(() => { if (!state) return; const remaining = new Date(state.session.expiresAt).getTime() - Date.now(); setCountdown(formatTime(remaining)); if (remaining <= 0) load().catch(() => undefined); }, 1000); return () => window.clearInterval(timer); }, [state?.session.expiresAt]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state?.messages.length]);

  const imageMessages = useMemo(() => state?.messages.filter(message => message.kind === "image" && message.mediaUrl) ?? [], [state?.messages]);
  const saveName = (event: React.FormEvent) => { event.preventDefault(); const value = nameDraft.trim().slice(0, 80); if (!value) return; localStorage.setItem(NAME_KEY, value); setName(value); };
  const startReply = (message: Message) => { setReply({ id: message.id, senderName: message.senderName, body: message.body || (message.kind === "image" ? "Photo" : "Video") }); setMenuMessage(null); setEmojiOpen(false); };
  const copyMessage = async (message: Message) => { if (message.body) await navigator.clipboard?.writeText(message.body); setMenuMessage(null); };
  const react = async (message: Message, emoji: string) => { setMenuMessage(null); await fetch("/api/chat/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id, name, emoji }) }); await load(); };
  const send = async () => {
    if (!name || sending || (!text.trim() && !attachments.length)) return; setSending(true); setError("");
    try {
      const jobs = attachments.length ? attachments : [null];
      for (let index = 0; index < jobs.length; index += 1) {
        const attachment = jobs[index]; const payload: Record<string, unknown> = { name, text: index === 0 ? text.trim() : "", replyTo: index === 0 ? reply : undefined };
        if (attachment) { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(attachment.file); }); payload.file = { name: attachment.file.name, type: attachment.file.type, data }; }
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not send");
      }
      setText(""); setAttachments([]); setReply(null); if (inputRef.current) inputRef.current.value = ""; await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send"); } finally { setSending(false); }
  };
  const onFiles = (candidates: FileList | null) => { if (!candidates?.length) return; const next: Attachment[] = []; for (const candidate of Array.from(candidates)) { if (!candidate.type.startsWith("image/") && !candidate.type.startsWith("video/")) { setError("Only photos and videos are allowed."); continue; } if (candidate.size > MAX_FILE_BYTES) { setError("Files must be 25MB or smaller."); continue; } next.push({ file: candidate, preview: URL.createObjectURL(candidate) }); } if (next.length) { setError(""); setAttachments(previous => [...previous, ...next]); } };
  const openImage = (message: Message) => { const index = imageMessages.findIndex(item => item.id === message.id); setLightboxIndex(index >= 0 ? index : null); setZoom(1); };
  const closeLightbox = () => { setLightboxIndex(null); setZoom(1); };
  const moveLightbox = (direction: number) => { if (lightboxIndex === null || !imageMessages.length) return; setLightboxIndex((lightboxIndex + direction + imageMessages.length) % imageMessages.length); setZoom(1); };

  return <main className="chat-app" onClick={() => setMenuMessage(null)}>
    <header className="topbar"><div className="brand"><span className="brand-mark"><span /><span /></span><div><h1>BaatChit</h1><p>A room for right now.</p></div></div><div className="top-actions"><div className="reset-chip"><span className="live-dot" /><span>resets in</span><strong>{countdown}</strong></div><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
    <section className="chat-window" aria-label="Chat messages">
      <div className="message-list">
        {!state?.messages.length && <div className="empty-state"><div className="empty-icon"><Zap size={20} /></div><h2>The room is quiet.</h2><p>Say hello — your message will appear here for everyone.</p></div>}
        {state?.messages.map(message => <article className={`message ${message.senderName === name ? "mine" : ""}`} key={message.id} onTouchStart={event => { touchStart.current = { id: message.id, x: event.changedTouches[0].clientX }; pressTimer.current = window.setTimeout(() => setMenuMessage(message.id), 550); }} onTouchEnd={event => { if (pressTimer.current) window.clearTimeout(pressTimer.current); const start = touchStart.current; if (start?.id === message.id && Math.abs(event.changedTouches[0].clientX - start.x) > 55) startReply(message); touchStart.current = null; }}>
          <div className="message-meta"><span className="avatar">{message.senderName.slice(0, 1).toUpperCase()}</span><strong>{message.senderName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <div className={`bubble ${message.kind !== "text" ? "media-bubble" : ""}`} onClick={event => { event.stopPropagation(); setMenuMessage(message.id); }} onContextMenu={event => { event.preventDefault(); setMenuMessage(message.id); }}>
            {message.replyToBody && <div className="reply-quote"><strong>{message.replyToSender}</strong><span>{message.replyToBody}</span></div>}
            {message.body && <p>{message.body}</p>}
            {message.kind === "image" && message.mediaUrl && <button className="image-button" onClick={event => { event.stopPropagation(); openImage(message); }} aria-label={`Open ${message.mediaName ?? "photo"}`}><img src={message.mediaUrl} alt={message.mediaName ?? "Shared photo"} /></button>}
            {message.kind === "video" && message.mediaUrl && <video src={message.mediaUrl} controls playsInline preload="metadata" />}
            {message.reactions && Object.keys(message.reactions).length > 0 && <div className="reactions">{Object.entries(message.reactions).map(([emoji, count]) => <button key={emoji} onClick={event => { event.stopPropagation(); react(message, emoji); }}>{emoji} {count}</button>)}</div>}
            {menuMessage === message.id && <div className="message-menu" onClick={event => event.stopPropagation()}><div className="reaction-row">{EMOJIS.slice(0, 6).map(emoji => <button key={emoji} onClick={() => react(message, emoji)}>{emoji}</button>)}</div><div className="menu-actions">{message.body && <button onClick={() => copyMessage(message)}><Copy size={14} /> Copy</button>}<button onClick={() => startReply(message)}><MessageCircleReply size={14} /> Reply</button></div></div>}
          </div>
        </article>)}<div ref={endRef} />
      </div>
      <div className="composer-wrap">
        {error && <div className="error-line">{error}</div>}
        {reply && <div className="reply-composer"><MessageCircleReply size={14} /><span><strong>Replying to {reply.senderName}</strong>{reply.body}</span><button onClick={() => setReply(null)} aria-label="Cancel reply"><X size={15} /></button></div>}
        {attachments.length > 0 && <div className="attachment-preview">{attachments.map((attachment, index) => <div className="attachment-thumb" key={`${attachment.file.name}-${index}`}>{attachment.file.type.startsWith("video/") ? <video src={attachment.preview} muted /> : <img src={attachment.preview} alt={attachment.file.name} />}<button onClick={() => setAttachments(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${attachment.file.name}`}><X size={13} /></button></div>)}</div>}
        {emojiOpen && <div className="emoji-picker">{EMOJIS.map(emoji => <button key={emoji} onClick={() => { setText(value => `${value}${emoji}`); setEmojiOpen(false); }}>{emoji}</button>)}</div>}
        <div className="composer"><button className="attach-button" aria-label="Attach photos or videos" onClick={() => inputRef.current?.click()}><Paperclip size={19} /><input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={event => onFiles(event.target.files)} /></button><button className="emoji-button" onClick={() => setEmojiOpen(open => !open)} aria-label="Open emoji picker"><Smile size={18} /></button><textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Write a message…" rows={1} /><button className="send-button" onClick={send} disabled={sending || (!text.trim() && !attachments.length)} aria-label="Send message"><Send size={18} /></button></div>
        <p className="composer-hint">Photos and videos up to 25MB · Enter to send</p>
      </div>
    </section>
    {!name && <div className="modal-backdrop"><form className="name-modal" onSubmit={saveName}><div className="modal-kicker"><span className="live-dot" /> OPEN ROOM</div><h2>What should we call you?</h2><p>Your name is saved only in this browser and shown beside your messages.</p><input autoFocus value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="Enter your name" maxLength={80} /><button type="submit" disabled={!nameDraft.trim()}>Enter the room <Send size={16} /></button></form></div>}
    {lightboxIndex !== null && imageMessages[lightboxIndex]?.mediaUrl && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={closeLightbox}><button className="lightbox-close" onClick={closeLightbox} aria-label="Close photo viewer"><X size={22} /></button><button className="lightbox-nav lightbox-prev" onClick={event => { event.stopPropagation(); moveLightbox(-1); }} aria-label="Previous photo">‹</button><div className="lightbox-content" onClick={event => event.stopPropagation()}><img src={imageMessages[lightboxIndex].mediaUrl} alt={imageMessages[lightboxIndex].mediaName ?? "Shared photo"} style={{ transform: `scale(${zoom})` }} onDoubleClick={() => setZoom(value => value === 1 ? 1.6 : 1)} onWheel={event => { event.preventDefault(); setZoom(value => Math.max(1, Math.min(3, value + (event.deltaY > 0 ? -0.15 : 0.15)))); }} /><div className="lightbox-tools"><button onClick={() => setZoom(value => Math.max(1, value - 0.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button></div></div><button className="lightbox-nav lightbox-next" onClick={event => { event.stopPropagation(); moveLightbox(1); }} aria-label="Next photo">›</button></div>}
  </main>;
}
