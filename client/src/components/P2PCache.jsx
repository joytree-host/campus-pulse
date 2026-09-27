import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';

// MVP peer-to-peer file cache: Socket.io only relays signaling messages
// (offer/answer/ICE candidates). The file itself streams directly between
// browsers over an RTCDataChannel once the connection is established.

// STUN alone only works when both peers can be reached directly (most home WiFi).
// Mobile carriers put devices behind CGNAT/symmetric NAT, which STUN cannot
// traverse — so we add a free public TURN relay (Open Relay Project) as a
// fallback path. It's rate-limited (20GB/month, shared, no SLA) — fine for
// testing/small classes; swap in your own TURN server or a paid Metered plan
// before relying on this for a whole campus.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];
const CHUNK_SIZE = 16 * 1024;

export default function P2PCache() {
  const [availableSeeds, setAvailableSeeds] = useState([]);
  const [seedingFile, setSeedingFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [socketStatus, setSocketStatus] = useState(socket.connected ? 'connected' : 'connecting…');
  const [socketError, setSocketError] = useState(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const fileRef = useRef(null); // File currently being seeded
  const seedInfoRef = useRef(null); // {fileId, fileName, fileSize} of the file we're seeding, if any
  const incomingRef = useRef({ chunks: [], receivedBytes: 0, fileSize: 0, fileName: '' });

  useEffect(() => {
    const onConnect = () => {
      setSocketStatus('connected');
      setSocketError(null);
      // The server's "who is seeding what" list lives only in memory and is tied
      // to the live socket connection. Mobile networks reconnect sockets often
      // (tower handoff, screen lock, backgrounding), which silently drops any
      // seed we had announced. Re-announce it so we don't vanish from peers'
      // lists without any visible error.
      if (seedInfoRef.current) {
        socket.emit('p2p:announce-seed', seedInfoRef.current);
      }
    };
    const onDisconnect = (reason) => setSocketStatus(`disconnected (${reason})`);
    const onConnectError = (err) => {
      setSocketStatus('connect_error');
      setSocketError(err.message || String(err));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.on('p2p:seed-list', (seeds) => {
      setAvailableSeeds((prev) => {
        const merged = [...prev];
        for (const s of seeds) {
          if (!merged.some((m) => m.fileId === s.fileId)) merged.push(s);
        }
        return merged;
      });
    });

    socket.on('p2p:seed-available', (info) => {
      setAvailableSeeds((prev) => [...prev.filter((s) => s.fileId !== info.fileId), info]);
    });

    socket.on('p2p:seed-removed', ({ fileId }) => {
      setAvailableSeeds((prev) => prev.filter((s) => s.fileId !== fileId));
    });

    socket.on('p2p:incoming-request', async ({ fileId, requesterSocketId }) => {
      if (!fileRef.current) return;
      const pc = createPeerConnection(requesterSocketId);
      const channel = pc.createDataChannel('file');
      setupSeederChannel(channel, fileRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('p2p:signal', { to: requesterSocketId, data: { type: 'offer', sdp: offer } });
    });

    socket.on('p2p:signal', async ({ from, data }) => {
      let pc = peersRef.current[from];
      if (!pc) pc = createPeerConnection(from);

      if (data.type === 'offer') {
        await pc.setRemoteDescription(data.sdp);
        pc.ondatachannel = (event) => setupReceiverChannel(event.channel);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('p2p:signal', { to: from, data: { type: 'answer', sdp: answer } });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(data.sdp);
      } else if (data.type === 'ice') {
        try { await pc.addIceCandidate(data.candidate); } catch (_) {}
      }
    });

    socket.on('p2p:no-seed', ({ fileId }) => {
      setDownloadProgress({ fileId, error: 'No peer is currently seeding this file.' });
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('p2p:seed-list');
      socket.off('p2p:seed-available');
      socket.off('p2p:seed-removed');
      socket.off('p2p:incoming-request');
      socket.off('p2p:signal');
      socket.off('p2p:no-seed');
    };
  }, []);

  function createPeerConnection(peerSocketId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('p2p:signal', { to: peerSocketId, data: { type: 'ice', candidate: event.candidate } });
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
        setDownloadProgress((prev) =>
          prev && !prev.done
            ? { error: `Connection ${pc.iceConnectionState} — the peer may be unreachable (different networks, strict firewall, or they closed the tab).` }
            : prev
        );
      }
    };
    peersRef.current[peerSocketId] = pc;
    return pc;
  }

  function setupSeederChannel(channel, file) {
    channel.binaryType = 'arraybuffer';
    channel.onopen = async () => {
      const buffer = await file.arrayBuffer();
      channel.send(JSON.stringify({ meta: true, name: file.name, size: buffer.byteLength }));
      for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
        channel.send(buffer.slice(offset, offset + CHUNK_SIZE));
      }
      channel.send(JSON.stringify({ done: true }));
    };
  }

  function setupReceiverChannel(channel) {
    channel.binaryType = 'arraybuffer';
    incomingRef.current = { chunks: [], receivedBytes: 0, fileSize: 0, fileName: '' };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.meta) {
          incomingRef.current.fileName = msg.name;
          incomingRef.current.fileSize = msg.size;
        } else if (msg.done) {
          const blob = new Blob(incomingRef.current.chunks);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = incomingRef.current.fileName || 'downloaded-file';
          a.click();
          setDownloadProgress({ done: true, fileName: incomingRef.current.fileName });
        }
        return;
      }
      incomingRef.current.chunks.push(event.data);
      incomingRef.current.receivedBytes += event.data.byteLength;
      const pct = incomingRef.current.fileSize
        ? Math.round((incomingRef.current.receivedBytes / incomingRef.current.fileSize) * 100)
        : null;
      setDownloadProgress({ pct, fileName: incomingRef.current.fileName });
    };
  }

  function handleSeed(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current = file;
    setSeedingFile(file);
    const fileId = `${file.name}-${file.size}-${Date.now()}`;
    const info = { fileId, fileName: file.name, fileSize: file.size };
    seedInfoRef.current = info;
    socket.emit('p2p:announce-seed', info);
  }

  function handleDownload(seed) {
    setDownloadProgress({ pct: 0, fileName: seed.fileName });
    socket.emit('p2p:request-file', { fileId: seed.fileId });
  }

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <h2 className="text-lg font-semibold mb-1">P2P Academic Cache</h2>
      <p className="text-xs text-slate-400 mb-3">
        Share a large file with everyone else on this page — transfer happens directly
        browser-to-browser over WebRTC, not through the server.
      </p>

      <div className={`mb-3 rounded-lg border p-3 text-xs break-words ${
        socketStatus === 'connected'
          ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
          : 'border-rose-500 bg-rose-950/50 text-rose-300'
      }`}>
        <div className="font-semibold mb-1">DEBUG: signaling socket status</div>
        <div>SOCKET_URL used: {import.meta.env.VITE_SOCKET_URL || '(not set — using http://localhost:4000)'}</div>
        <div>Status: {socketStatus}</div>
        {socketError && <div>Error: {socketError}</div>}
      </div>

      <label className="block text-sm mb-4">
        <span className="text-slate-400">Seed a file:</span>
        <input type="file" onChange={handleSeed} className="block mt-1 text-sm" />
      </label>
      {seedingFile && (
        <p className="text-xs text-emerald-400 mb-3">Seeding: {seedingFile.name}</p>
      )}

      <h3 className="text-sm font-medium text-slate-300 mb-2">Available from peers</h3>
      {availableSeeds.length === 0 && (
        <p className="text-slate-500 text-sm">No one is seeding a file right now.</p>
      )}
      <ul className="space-y-2">
        {availableSeeds.map((s) => (
          <li key={s.fileId} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 text-sm">
            <span>{s.fileName} ({(s.fileSize / 1024 / 1024).toFixed(1)} MB)</span>
            <button
              onClick={() => handleDownload(s)}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs"
            >
              Fetch over LAN
            </button>
          </li>
        ))}
      </ul>

      {downloadProgress && (
        <p className="mt-3 text-sm text-slate-300">
          {downloadProgress.error && <span className="text-rose-400">{downloadProgress.error}</span>}
          {downloadProgress.done && <span className="text-emerald-400">Downloaded {downloadProgress.fileName}</span>}
          {!downloadProgress.done && !downloadProgress.error && (
            <span>Downloading {downloadProgress.fileName}… {downloadProgress.pct ?? 0}%</span>
          )}
        </p>
      )}
    </section>
  );
}
