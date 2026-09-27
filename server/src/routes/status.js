const express = require('express');
const prisma = require('../db');
const { probeAll } = require('../statusProbe');

const router = express.Router();

// Latest status per target
router.get('/', async (req, res) => {
  const results = await probeAll();
  res.json(results);
});

// History for one target
router.get('/history/:targetName', async (req, res) => {
  const target = await prisma.serviceTarget.findUnique({
    where: { name: req.params.targetName },
  });
  if (!target) return res.status(404).json({ error: 'Unknown target' });

  const logs = await prisma.serviceStatusLog.findMany({
    where: { targetId: target.id },
    orderBy: { checkedAt: 'desc' },
    take: 50,
  });
  res.json(logs);
});

module.exports = router;
