# BaatChit — Implementation & Design Plan

## Product scope
BaatChit is a public, no-login shared chat. A visitor enters a display name once per browser, then can send text, images, and videos. Messages are shared through the managed database and appear in other open tabs without a manual refresh. The active chat session resets every 24 hours, with the remaining time shown in the header. The interface defaults to the user's system theme and includes a compact manual light/dark toggle.

## Implementation
- **Frontend:** React + TypeScript + Tailwind in `client/src/pages/Home.tsx`, with a small name dialog, full-height message timeline, file previews, countdown, and responsive composer.
- **Backend:** Express routes under `/api/chat` with no authentication. The server lazily creates/renews one active 24-hour session, lists messages, accepts text/media messages, and uploads media through the managed storage helper.
- **Database:** Drizzle tables for `chatSessions` and `chatMessages`; media messages store a durable `/manus-storage/...` path and MIME metadata.
- **Live sync:** Browser uses a Server-Sent Events endpoint `/api/chat/stream` and a small fallback refresh, so open tabs receive newly created messages without reloading.
- **Reset:** Any request after expiry starts a new session and deletes the old session's messages; the UI countdown is calculated from the server-provided `expiresAt`.
- **Routes:** Only `/` and `/404` are page routes; `/manus-routes.json` declares them.

## Design

### Style options
1. **Quiet editorial messenger** — 0.07 probability; restrained typography, warm neutrals, and precise spacing.
2. **Midnight signal** — 0.06 probability; dark-first neon accents and dense control surfaces.
3. **Soft utility** — 0.08 probability; light surfaces, rounded controls, and friendly blue-violet highlights.

**Chosen style: Quiet editorial messenger.**

- **Design Movement:** Modern editorial utility, borrowing from print margins and high-signal communication tools.
- **Core Principles:** Message-first hierarchy; calm contrast; compact controls; strong readability at every viewport.
- **Color Philosophy:** A near-white paper background and graphite ink keep the room quiet, while one electric indigo accent marks presence, sending, and live state. Dark mode becomes ink-on-charcoal with the same accent as the anchor.
- **Layout Paradigm:** Edge-to-edge chat canvas with a narrow, lightly separated header and a message rail that grows into the available viewport; no dashboard cards or decorative sections.
- **Signature Elements:** A small indigo live dot, monospaced countdown numerals, and message bubbles with a subtle editorial left rule.
- **Interaction Philosophy:** Every action has immediate feedback: name save, sending state, media preview, live arrival, and reset time are visible but quiet.
- **Animation:** Use short opacity/translate transitions for new bubbles and attachment previews; avoid looping motion except the live indicator.
- **Typography System:** Inter/system sans for UI, with compact mono numerals for the countdown and timestamps.
- **Brand Essence:** A low-friction room for messages that should be shared now, not archived forever. Calm, immediate, temporary.
- **Brand Voice:** Headlines are concise; helper text is direct. Example: “A room for right now.” / “This chat clears in 24 hours.”
- **Wordmark & Logo:** “BaatChit” with a two-line speech-mark glyph suggesting two overlapping conversation strokes.
- **Signature Brand Color:** Electric indigo `#635BFF` used sparingly for live state and primary actions.

## Project structure
- `client/src/pages/Home.tsx`: chat shell, name flow, polling/SSE, composer, media rendering.
- `client/src/index.css`: theme tokens, responsive layout, motion, and message surfaces.
- `server/chat.ts`: session lifecycle, database reads/writes, media storage, and SSE subscribers.
- `drizzle/schema.ts` and `server/db.ts`: persistent chat schema and helpers.
- `public/manus-routes.json`: page route declaration.
