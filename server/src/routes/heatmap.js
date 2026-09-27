const express = require('express');
const prisma = require('../db');

module.exports = function heatmapRouter(io) {
  const router = express.Router();

  function classify(downloadMbps) {
    if (downloadMbps == null) return 'DOWN';
    if (downloadMbps >= 20) return 'ONLINE';
    if (downloadMbps >= 5) return 'CONGESTED';
    return 'DOWN';
  }

  // Submit a speed test result for a room
  router.post('/', async (req, res) => {
    const { roomId, latencyMs, downloadMbps, bssid } = req.body;
    if (!roomId) return res.status(400).json({ error: 'roomId required' });

    const room = await prisma.room.findUnique({ where: { id: Number(roomId) } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const statusFlag = classify(downloadMbps);

    const log = await prisma.networkLog.create({
      data: {
        roomId: room.id,
        latencyMs,
        downloadMbps,
        statusFlag,
        reportedBssid: bssid || null,
      },
    });

    // Learn the BSSID -> room mapping the first time we see it (Module 3C)
    if (bssid && !room.bssid) {
      await prisma.room.update({ where: { id: room.id }, data: { bssid } });
    }

    const payload = {
      roomId: room.id,
      roomName: room.name,
      buildingId: room.buildingId,
      latencyMs,
      downloadMbps,
      statusFlag,
      createdAt: log.createdAt,
    };
    io.emit('heatmap:update', payload);

    res.status(201).json(payload);
  });

  // Latest reading per room, for the map/table view
  router.get('/latest', async (req, res) => {
    const rooms = await prisma.room.findMany({
      include: {
        building: true,
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const results = rooms.map((r) => ({
      roomId: r.id,
      roomName: r.name,
      building: r.building.name,
      latest: r.logs[0] || null,
    }));

    res.json(results);
  });

  return router;
};
