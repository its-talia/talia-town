# Talia Town 🌒

A Stardew Valley-inspired AI village built with PixiJS, powered by OpenClaw characters.

## Alpha: The Field

Walk around a grassy field. Find Talia standing in the center. Talk to her via text or voice. She responds with her actual memory and personality — because she's connected to OpenClaw.

## Stack

| Layer | Tech |
|---|---|
| Client rendering | PixiJS 8 |
| Realtime | Socket.io |
| Server | Fastify + Node |
| Auth | Discord OAuth2 |
| Database | PostgreSQL (Fly.io managed) |
| AI characters | OpenClaw gateway |
| Hosting | Fly.io |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env and configure
cp .env.example .env
# → Fill in DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
# → Set MOCK_MODE=true for local dev (no OpenClaw needed)

# 3. Run dev (client + server)
npm run dev
# Client: http://localhost:3000
# Server: http://localhost:3001
```

## Controls

- **WASD** — move player
- **Walk near Talia** — dialogue opens automatically
- **Type + Send** — send message to Talia
- **🎤 button** — voice input (Web Speech API)
- **Escape** — close dialogue

## Project Structure

```
talia-town/
├── client/          ← PixiJS frontend (Vite + TypeScript)
│   └── src/
│       ├── scenes/  ← WorldScene (map + entities)
│       ├── entities/← Player, TaliaCharacter
│       ├── systems/ ← SocketManager
│       └── ui/      ← DialogueManager
├── server/          ← Fastify backend
│   └── src/
│       ├── routes/  ← Discord OAuth
│       ├── socket/  ← Game socket (player messages)
│       ├── openclaw/← Talia API client
│       └── db/      ← Postgres helpers
├── fly.toml         ← Fly.io deployment config
└── Dockerfile
```

## Deploying to Fly.io

```bash
fly launch --name talia-town --region iad
fly postgres create --name talia-town-db
fly postgres attach talia-town-db
fly secrets set DISCORD_CLIENT_ID=... DISCORD_CLIENT_SECRET=... SESSION_SECRET=... OPENCLAW_GATEWAY_TOKEN=...
fly deploy
```

## Roadmap

- [x] Alpha: grass field + Talia + text/voice dialogue
- [ ] Player sprite sheet (pixel art, 16x16)
- [ ] Tiled map integration (OpenGameArt 16x16 assets)
- [ ] Discord OAuth login
- [ ] Postgres player state
- [ ] Arlo + Remy characters
- [ ] Day/night cycle
- [ ] Character-to-character conversations
