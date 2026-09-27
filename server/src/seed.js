// EDIT THIS FILE with your real campus buildings/rooms before deploying.
// Then run: npm run seed
require('dotenv').config();
const prisma = require('./db');

const BUILDINGS = [
  {
    name: 'Central Library',
    zone: 'North Campus',
    rooms: ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4 - Quiet Zone'],
  },
  {
    name: 'Engineering Block',
    zone: 'East Campus',
    rooms: ['Room 101', 'Room 102', 'Room 110'],
  },
  {
    name: 'Science Complex',
    zone: 'East Campus',
    rooms: ['Main Auditorium', 'Lab 204'],
  },
  {
    name: 'Cafeteria',
    zone: 'Central Campus',
    rooms: ['Main Hall'],
  },
];

async function main() {
  for (const b of BUILDINGS) {
    const building = await prisma.building.upsert({
      where: { name: b.name },
      update: {},
      create: { name: b.name, zone: b.zone },
    }).catch(async () => {
      // upsert on non-unique `name` isn't valid until we add a unique constraint;
      // fall back to find-or-create.
      const existing = await prisma.building.findFirst({ where: { name: b.name } });
      if (existing) return existing;
      return prisma.building.create({ data: { name: b.name, zone: b.zone } });
    });

    for (const roomName of b.rooms) {
      const existingRoom = await prisma.room.findFirst({
        where: { buildingId: building.id, name: roomName },
      });
      if (!existingRoom) {
        await prisma.room.create({
          data: { buildingId: building.id, name: roomName },
        });
      }
    }
  }

  const targets = (process.env.STATUS_TARGETS || '').split(',').filter(Boolean);
  for (const t of targets) {
    const [name, url] = t.split('|');
    if (!name || !url) continue;
    await prisma.serviceTarget.upsert({
      where: { name: name.trim() },
      update: { url: url.trim() },
      create: { name: name.trim(), url: url.trim() },
    });
  }

  console.log('Seed complete: buildings, rooms, and status targets loaded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
