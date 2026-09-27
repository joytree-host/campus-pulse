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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const STATUS_INTERVAL_MS = Number(process.env.STATUS_INTERVAL_MS || 30000);

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN },
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
