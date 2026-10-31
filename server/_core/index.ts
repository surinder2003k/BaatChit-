import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { addSubscriber, getChatState, getMessagesSince, postChatMessage } from "../chat";
import { storageGetSignedUrl } from "../storage";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.get("/api/chat", async (_req, res) => {
    try { res.json(await getChatState()); } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.get("/api/chat/messages", async (req, res) => {
    try { res.json({ messages: await getMessagesSince(Number(req.query.afterId || 0)) }); } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.get("/api/chat/stream", (_req, res) => addSubscriber(res));
  app.get("/api/chat/media", async (req, res) => {
    try {
      const key = String(req.query.key || "").replace(/^\/+/, "");
      if (!key || key.includes("..")) return res.status(400).json({ error: "Invalid media key" });
      res.redirect(307, await storageGetSignedUrl(key));
    } catch (error) { res.status(404).json({ error: "Media not found" }); }
  });
  app.post("/api/chat", async (req, res) => {
    try { res.json({ message: await postChatMessage(req.body) }); } catch (error) { res.status(400).json({ error: String(error).replace(/^Error: /, "") }); }
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
