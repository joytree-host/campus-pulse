# Deploying CampusPulse (all on Render)

`render.yaml` at the repo root now defines **two** services:
- `joytree-campus-pulse-api` — the Node/Express/Socket.io backend
- `joytree-campus-pulse-web` — the React frontend, built as a static site

Both deploy from the same Blueprint, so it's one flow.

## 1. Deploy the Blueprint

1. Render Dashboard → **New** → **Blueprint**
2. Connect repo `joytree-host/campus-pulse`, branch `main`
3. Render reads `render.yaml` and shows both services. Click **Apply**.
4. Both will fail their first deploy — expected, since env vars aren't set yet.

## 2. Set backend env vars

On `joytree-campus-pulse-api` → Environment tab:
- `DATABASE_URL` → your Postgres connection string
- `STATUS_TARGETS` → your real portal/LMS URLs
- `CORS_ORIGIN` → leave a placeholder for now, you'll fix it in step 4

## 3. Set frontend env vars

On `joytree-campus-pulse-web` → Environment tab:
- `VITE_API_URL` → your backend's `.onrender.com` URL (e.g. `https://joytree-campus-pulse-api.onrender.com`)
- `VITE_SOCKET_URL` → same value as above

Redeploy this service after setting these (static sites bake env vars in at build time).

## 4. Close the loop on CORS

Copy the frontend's live `.onrender.com` URL, go back to `joytree-campus-pulse-api` → Environment → set `CORS_ORIGIN` to that exact URL, redeploy the backend.

## 5. Sanity checks

- `https://<api-service>.onrender.com/health` → `{"ok":true}`
- Visit `https://<web-service>.onrender.com` → the actual dashboard should load and Status Board should populate
- Two tabs open, seed a file in **P2P Academic Cache** in one, fetch from the other — confirms WebRTC signaling works

## Notes

- Free-tier Render services spin down after inactivity and take ~30-60s to wake up on the next request — that's normal, not a bug.
- The database is already set to PostgreSQL (`schema.prisma`) and the build step runs `prisma db push`, so tables get created/updated automatically on every deploy — nothing to run manually.
- Free-tier Render services have no Shell/SSH access, so seeding runs automatically as part of every build (`node src/seed.js` after `prisma db push`). It's safe to run repeatedly — it only creates rows that don't already exist. To load your real campus data: edit `server/src/seed.js` with your actual buildings/rooms, commit, push — the next deploy seeds it.
