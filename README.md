# CampusPulse

A real-time, crowdsourced campus network health & utility dashboard.

Modules:
1. **Service Status Dashboard** — pings campus endpoints (portal, LMS, library login) and broadcasts up/down status over WebSockets.
2. **Wi-Fi Heatmap** — students run a speed test, pick their location (dropdown or BSSID auto-detect later), results feed a live map/table.
3. **P2P Academic Cache** — WebRTC data channels let students on the same LAN fetch large files from a peer instead of the internet gateway.
4. **Personal Network Insights** — shows the student's own connection diagnostics.

## Stack
- **Backend:** Node.js, Express, Socket.io, Prisma + SQLite (swap to Postgres later by changing `DATABASE_URL`)
- **Frontend:** React (Vite), Tailwind CSS, socket.io-client

## Project layout
```
campus-pulse/
  server/   Express + Socket.io API, status prober, Prisma schema
  client/   Vite React frontend
```

## Quick start (local)

```bash
# 1. Backend
cd server
npm install
cp .env.example .env         # edit DATABASE_URL, PORT, STATUS_TARGETS
npx prisma migrate dev --name init
npm run seed                 # loads sample buildings/rooms — EDIT seed.js with your real campus first
npm run dev                  # starts API + sockets on :4000

# 2. Frontend (new terminal)
cd client
npm install
cp .env.example .env         # set VITE_API_URL / VITE_SOCKET_URL to the backend above
npm run dev                  # starts Vite dev server on :5173
```

Open http://localhost:5173.

## What you still have to do manually

This repo gives you working code. It cannot, by itself:

1. **Install runtimes** — Node.js 18+, and a database (SQLite ships built-in via Prisma; swap to Postgres/Supabase/Neon for production).
2. **Seed real campus data** — edit `server/src/seed.js` with your actual buildings/rooms/endpoints, then re-run `npm run seed`.
3. **Configure status targets** — set `STATUS_TARGETS` in `server/.env` to the real portal/LMS URLs you want probed.
4. **Deploy the backend** — pick a host that supports long-lived WebSocket connections (Render, Railway, Fly.io). Set env vars there too.
5. **Deploy the frontend** — Vercel/Netlify; point `VITE_API_URL`/`VITE_SOCKET_URL` at your deployed backend.
6. **HTTPS + CORS** — WebRTC and geolocation-adjacent browser APIs require `https://`. Set `CORS_ORIGIN` in the backend `.env` to your deployed frontend URL exactly.
7. **Bootstrap BSSID fingerprinting** — walk to a few hotspots yourself, select the room manually, run a speed test, to seed the first BSSID → room links (feature stub in `heatmap` routes — extend `NetworkLog` with a `bssid` field once you're collecting it client-side).
8. **Provision a persistent DB** for production so data survives restarts (Supabase/Neon free tier Postgres).

## Notes on the P2P module

The included P2P cache is a working MVP: Socket.io is used purely as a signaling channel to exchange WebRTC offers/answers/ICE candidates between browser tabs; actual file bytes move peer-to-peer over a `RTCDataChannel`, never through the server. It's deliberately simple (single-file transfer, manual "share" trigger) — production hardening (chunked resumable transfer, multiple simultaneous peers, NAT traversal via TURN servers for stricter campus firewalls) is a next step.
