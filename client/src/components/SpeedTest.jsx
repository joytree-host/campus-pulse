import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Rough client-side speed test: times a fetch of a known-size public asset.
// For a real deployment, host a fixed-size file yourself so results are comparable.
const TEST_FILE_URL = 'https://speed.hetzner.de/100MB.bin';
const TEST_SLICE_BYTES = 5 * 1024 * 1024; // only pull first ~5MB via range request

async function runSpeedTest() {
  const start = performance.now();
  const res = await fetch(TEST_FILE_URL, {
    headers: { Range: `bytes=0-${TEST_SLICE_BYTES}` },
  });
  const blob = await res.blob();
  const durationSec = (performance.now() - start) / 1000;
  const mbits = (blob.size * 8) / (1024 * 1024);
  return {
    downloadMbps: Number((mbits / durationSec).toFixed(1)),
    latencyMs: Number((durationSec * 1000).toFixed(0)),
  };
}

export default function SpeedTest({ selectedBuildingId, selectedRoomId }) {
  const [buildings, setBuildings] = useState([]);
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [status, setStatus] = useState('idle'); // idle | testing | done | error
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getBuildings().then(setBuildings).catch(() => {});
  }, []);

  // Sync with a room tapped on the Campus Map above
  useEffect(() => {
    if (selectedBuildingId != null) setBuildingId(String(selectedBuildingId));
    if (selectedRoomId != null) setRoomId(String(selectedRoomId));
  }, [selectedBuildingId, selectedRoomId]);

  const rooms = buildings.find((b) => String(b.id) === String(buildingId))?.rooms || [];

  async function handleAddCustomRoom() {
    if (!buildingId || !customRoom.trim()) return;
    const room = await api.addRoom(buildingId, customRoom.trim());
    setBuildings((prev) =>
      prev.map((b) => (b.id === Number(buildingId) ? { ...b, rooms: [...b.rooms, room] } : b))
    );
    setRoomId(String(room.id));
    setCustomRoom('');
  }

  async function handleRunTest() {
    if (!roomId) return;
    setStatus('testing');
    try {
      const { downloadMbps, latencyMs } = await runSpeedTest();
      const submitted = await api.submitSpeedTest({ roomId: Number(roomId), downloadMbps, latencyMs });
      setResult(submitted);
      setStatus('done');
    } catch (err) {
      setStatus('error');
    }
  }

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <h2 className="text-lg font-semibold mb-3">Run a Speed Test</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className="bg-slate-800 rounded-lg px-3 py-2"
          value={buildingId}
          onChange={(e) => { setBuildingId(e.target.value); setRoomId(''); }}
        >
          <option value="">Select building…</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          className="bg-slate-800 rounded-lg px-3 py-2"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={!buildingId}
        >
          <option value="">Select room…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {buildingId && (
        <div className="flex gap-2 mt-3">
          <input
            className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm"
            placeholder="Not listed? Type a room name…"
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
          />
          <button
            onClick={handleAddCustomRoom}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            Add
          </button>
        </div>
      )}

      <button
        onClick={handleRunTest}
        disabled={!roomId || status === 'testing'}
        className="mt-4 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
      >
        {status === 'testing' ? 'Testing…' : 'Test Speed'}
      </button>

      {status === 'done' && result && (
        <p className="mt-3 text-sm text-emerald-400">
          Logged: {result.downloadMbps} Mbps, {result.latencyMs}ms — status {result.statusFlag}
        </p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-sm text-rose-400">Speed test failed — check console for details.</p>
      )}
    </section>
  );
}
