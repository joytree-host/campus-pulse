const fetch = require('node-fetch');
const prisma = require('./db');

const TIMEOUT_MS = 6000;

async function probeOne(target) {
  const start = Date.now();
  let status = 'DOWN';
  let latencyMs = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(target.url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    latencyMs = Date.now() - start;
    status = res.ok || (res.status >= 200 && res.status < 500) ? 'UP' : 'DOWN';
  } catch (err) {
    status = 'DOWN';
  }

  await prisma.serviceStatusLog.create({
    data: { targetId: target.id, status, latencyMs },
  });

  return { name: target.name, url: target.url, status, latencyMs, checkedAt: new Date() };
}

async function probeAll() {
  const targets = await prisma.serviceTarget.findMany();
  const results = await Promise.all(targets.map(probeOne));
  return results;
}

function startStatusLoop(io, intervalMs) {
  const run = async () => {
    try {
      const results = await probeAll();
      io.emit('status:update', results);
    } catch (err) {
      console.error('Status probe loop error:', err.message);
    }
  };

  run(); // run once immediately on boot
  return setInterval(run, intervalMs);
}

module.exports = { probeAll, startStatusLoop };
