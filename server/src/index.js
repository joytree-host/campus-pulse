require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const statusRouter = require('./routes/status');
const locationsRouter = require('./routes/locations');
const heatmapRouterFactory = require('./routes/heatmap');
const { startStatusLoop } = require('./statusProbe');
const { registerSockets } = require('./sockets');

const PORT = process.env.PORT || 4000;
// CORS_ORIGIN can be a single URL or a comma-separated list (e.g. prod + preview
// deploys). Previously this only accepted one exact origin, which silently broke
// every request (including the Socket.io handshake, showing as "xhr poll error")
// whenever the frontend was served from any URL other than that one.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const STATUS_INTERVAL_MS = Number(process.env.STATUS_INTERVAL_MS || 30000);

function originCheck(origin, callback) {
  // Allow no-origin requests (curl, server-to-server, some mobile webviews)
  if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  console.warn(`CORS blocked origin: ${origin}. Allowed: ${ALLOWED_ORIGINS.join(', ')}`);
  return callback(null, false);
}

const app = express();
app.use(cors({ origin: originCheck }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: originCheck },
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/status', statusRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/heatmap', heatmapRouterFactory(io));

registerSockets(io);
startStatusLoop(io, STATUS_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`CampusPulse server listening on :${PORT}`);
});
