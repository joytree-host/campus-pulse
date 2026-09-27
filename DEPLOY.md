# Deploying CampusPulse (Render + Vercel)

This repo includes config files so both platforms can mostly auto-detect the setup:
`render.yaml` (backend) and `client/vercel.json` (frontend).

## 1. Backend on Render

1. Push this repo to GitHub (already done if you're reading this from `joytree-host/campus-pulse`).
2. In Render: **New → Blueprint**, point it at this repo. It should pick up `render.yaml`
   and propose a service named `joytree-campus-pulse-api` with root dir `server`.
3. Before the first deploy, set these env vars in the Render dashboard (marked `sync: false` in `render.yaml`, so Render will prompt for them):
   - `CORS_ORIGIN` — leave as `http://localhost:5173` for now, come back and update it once you have your Vercel URL (step 2.5 below).
   - `STATUS_TARGETS` — your real portal/LMS/library URLs, e.g. `Student Portal|https://portal.myschool.edu,LMS|https://lms.myschool.edu`.
   - `DATABASE_URL` — see the database note below.
4. **Database:** the schema is already set to `provider = "postgresql"`. Just set `DATABASE_URL` in Render's dashboard to your Postgres connection string (Render Postgres, Supabase, Neon, or your own instance) — nothing else to run. The build step calls `prisma db push`, which creates/updates all tables automatically on deploy. No local commands or migration files needed.
5. Render's free plan supports WebSockets by default — no extra toggle needed, but double check under the service's **Settings** if you don't see live updates.
6. After first deploy, seed your real data: open a Render **Shell** for the service and run `npm run seed` (after you've edited `server/src/seed.js` with your actual buildings/rooms).

## 2. Frontend on Vercel

1. In Vercel: **Add New → Project**, import `joytree-host/campus-pulse`.
2. Set **Root Directory** to `client`.
3. Vercel will detect Vite via `client/vercel.json`. Framework preset: "Vite".
4. Set environment variables (Project Settings → Environment Variables):
   - `VITE_API_URL` — your Render backend URL, e.g. `https://joytree-campus-pulse-api.onrender.com`
   - `VITE_SOCKET_URL` — same URL as above (Socket.io shares the HTTP server).
5. Deploy. Vercel gives you an `https://...vercel.app` URL automatically — that's your `CORS_ORIGIN` value.

## 2.5 Close the loop

Go back to Render, update `CORS_ORIGIN` to your exact Vercel URL (no trailing slash), and redeploy the backend so it accepts requests from the live frontend.

## 3. Sanity checks after deploy

- Visit `https://<your-render-service>.onrender.com/health` — should return `{"ok":true}`.
- Visit your Vercel URL — Status Board should populate; if it's empty, re-check `STATUS_TARGETS` and that you ran the seed script.
- Open the site in two browser tabs, seed a small file in one under **P2P Academic Cache**, fetch it from the other — confirms WebRTC signaling is working end to end.

## Alternative: Railway instead of Render

The included `server/Procfile` (`web: npm run build && npm start`) works with Railway's Node buildpack the same way. Steps are equivalent: new project from repo, set root directory to `server`, add the same env vars, provision Railway's Postgres add-on instead of Render's.
