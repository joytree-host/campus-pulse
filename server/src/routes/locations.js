const express = require('express');
const prisma = require('../db');

const router = express.Router();

// List all buildings with rooms, for the dropdown/room picker
router.get('/', async (req, res) => {
  const buildings = await prisma.building.findMany({
    include: { rooms: true },
    orderBy: { name: 'asc' },
  });
  res.json(buildings);
});

// Add a custom room a student typed in (Module 3B: Dynamic Room Registration)
router.post('/:buildingId/rooms', async (req, res) => {
  const buildingId = Number(req.params.buildingId);
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Room name required' });

  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) return res.status(404).json({ error: 'Building not found' });

  const existing = await prisma.room.findFirst({ where: { buildingId, name: name.trim() } });
  if (existing) return res.json(existing);

  const room = await prisma.room.create({ data: { buildingId, name: name.trim() } });
  res.status(201).json(room);
});

// Look up a room by a previously-learned BSSID fingerprint
router.get('/by-bssid/:bssid', async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { bssid: req.params.bssid },
    include: { building: true },
  });
  if (!room) return res.status(404).json({ error: 'No room mapped to this BSSID yet' });
  res.json(room);
});

module.exports = router;
