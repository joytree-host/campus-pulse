// Socket.io is used two ways here:
// 1. Broadcasting status/heatmap updates to everyone (handled by emit calls elsewhere).
// 2. As a *signaling* relay for the P2P file cache: peers exchange WebRTC offers/
//    answers/ICE candidates through the server, but the actual file bytes travel
//    directly between browsers over an RTCDataChannel - never through this server.

function registerSockets(io) {
  // key: fileId -> socketId of the peer currently "seeding" that file
  const seeders = new Map();

  io.on('connection', (socket) => {
    // Catch up newly-connected clients on files already being seeded —
    // otherwise a tab that opens after the announcement never learns about it.
    if (seeders.size > 0) {
      const currentSeeds = [...seeders.entries()].map(([fileId, s]) => ({
        fileId,
        fileName: s.fileName,
        fileSize: s.fileSize,
      }));
      socket.emit('p2p:seed-list', currentSeeds);
    }

    socket.on('p2p:announce-seed', ({ fileId, fileName, fileSize }) => {
      seeders.set(fileId, { socketId: socket.id, fileName, fileSize });
      socket.broadcast.emit('p2p:seed-available', { fileId, fileName, fileSize });
    });

    socket.on('p2p:request-file', ({ fileId }) => {
      const seeder = seeders.get(fileId);
      if (!seeder) {
        socket.emit('p2p:no-seed', { fileId });
        return;
      }
      // Ask the seeder to start a WebRTC handshake with this requester
      io.to(seeder.socketId).emit('p2p:incoming-request', {
        fileId,
        requesterSocketId: socket.id,
      });
    });

    // Generic relay for offer/answer/ICE candidates, addressed by target socket id
    socket.on('p2p:signal', ({ to, data }) => {
      io.to(to).emit('p2p:signal', { from: socket.id, data });
    });

    socket.on('disconnect', () => {
      for (const [fileId, seeder] of seeders.entries()) {
        if (seeder.socketId === socket.id) {
          seeders.delete(fileId);
          socket.broadcast.emit('p2p:seed-removed', { fileId });
        }
      }
    });
  });
}

module.exports = { registerSockets };
