import { and, asc, eq, gt } from "drizzle-orm";
import type { Response } from "express";
import { chatMessages, chatSessions, type ChatSession } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";

const SESSION_MS = 24 * 60 * 60 * 1000;
const subscribers = new Set<Response>();
let sessionPromise: Promise<ChatSession | null> | null = null;

type ChatPayload = {
  name?: string;
  text?: string;
  file?: { name?: string; type?: string; data?: string };
};

function cleanName(value: unknown) {
  return String(value ?? "").trim().slice(0, 80);
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().slice(0, 4000);
}

async function activeSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is not available");
    const now = new Date();
    const existing = await db.select().from(chatSessions).orderBy(asc(chatSessions.id)).limit(1);
    if (existing[0] && existing[0].expiresAt.getTime() > now.getTime()) return existing[0];
    if (existing[0]) {
      await db.delete(chatMessages).where(eq(chatMessages.sessionId, existing[0].id));
      await db.delete(chatSessions).where(eq(chatSessions.id, existing[0].id));
    }
    const expiresAt = new Date(now.getTime() + SESSION_MS);
    await db.insert(chatSessions).values({ startedAt: now, expiresAt });
    const created = await db.select().from(chatSessions).orderBy(asc(chatSessions.id)).limit(1);
    return created[0] ?? null;
  })().finally(() => { sessionPromise = null; });
  return sessionPromise;
}

export async function getChatState() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const session = await activeSession();
  if (!session) throw new Error("Unable to create chat session");
  const messages = await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(asc(chatMessages.id));
  return { session: { id: session.id, startedAt: session.startedAt, expiresAt: session.expiresAt }, messages: messages.map(normalizeMediaUrl) };
}

export async function postChatMessage(payload: ChatPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const name = cleanName(payload.name);
  if (!name) throw new Error("Name is required");
  const text = cleanText(payload.text);
  const file = payload.file;
  if (!text && !file?.data) throw new Error("Message is empty");
  const session = await activeSession();
  if (!session) throw new Error("Unable to create chat session");

  let kind: "text" | "image" | "video" = "text";
  let mediaUrl: string | undefined;
  let mediaName: string | undefined;
  let mediaType: string | undefined;
  if (file?.data) {
    const type = String(file.type ?? "").toLowerCase();
    if (!type.startsWith("image/") && !type.startsWith("video/")) throw new Error("Only photos and videos are allowed");
    const raw = file.data.includes(",") ? file.data.split(",", 2)[1] : file.data;
    const buffer = Buffer.from(raw, "base64");
    if (buffer.byteLength > 25 * 1024 * 1024) throw new Error("Files must be 25MB or smaller");
    kind = type.startsWith("video/") ? "video" : "image";
    const stored = await storagePut(`baatchit/${Date.now()}-${file.name ?? "upload"}`, buffer, type);
    mediaUrl = stored.url;
    mediaName = String(file.name ?? "media").slice(0, 255);
    mediaType = type.slice(0, 120);
  }
  await db.insert(chatMessages).values({
    sessionId: session.id, senderName: name, kind, body: text || null,
    mediaUrl: mediaUrl ?? null, mediaName: mediaName ?? null, mediaType: mediaType ?? null,
  });
  const created = await db.select().from(chatMessages).where(eq(chatMessages.sessionId, session.id)).orderBy(asc(chatMessages.id));
  const message = normalizeMediaUrl(created[created.length - 1]);
  broadcast({ type: "message", message });
  return message;
}

export async function getMessagesSince(afterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const session = await activeSession();
  if (!session) throw new Error("Unable to create chat session");
  const messages = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.sessionId, session.id), gt(chatMessages.id, afterId)))
    .orderBy(asc(chatMessages.id));
  return messages.map(normalizeMediaUrl);
}

function normalizeMediaUrl(message: typeof chatMessages.$inferSelect) {
  if (message?.mediaUrl?.startsWith("/manus-storage/")) {
    return { ...message, mediaUrl: `/api/chat/media?key=${encodeURIComponent(message.mediaUrl.slice("/manus-storage/".length))}` };
  }
  return message;
}

export function addSubscriber(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  subscribers.add(res);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000);
  res.on("close", () => { clearInterval(heartbeat); subscribers.delete(res); });
}

function broadcast(data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of subscribers) {
    try { res.write(payload); } catch { subscribers.delete(res); }
  }
}
