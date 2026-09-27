import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { socket } from '../socket';

// MVP "floor plan": since we don't have real building blueprint images,
// each building's rooms are auto-laid out as a responsive grid of tiles,
// color-coded by their latest heatmap reading. Click a tile to select that
// room (bubbles up to the parent so SpeedTest can be pre-filled with it).
//
// To upgrade to true floor plans later: replace the grid in `RoomTile`
// layout with <image> + positioned <rect> overlays using real coordinates
// from a scanned blueprint (see README "Location Mapping" section).

const STATUS_COLOR = {
  ONLINE: '#10b981',
  CONGESTED: '#f59e0b',
  DOWN: '#f43f5e',
  UNKNOWN: '#475569',
};

function statusOf(room) {
  return room.latest?.statusFlag || 'UNKNOWN';
}

function RoomTile({ room, selected, onSelect }) {
  const status = statusOf(room);
  return (
    <button
      onClick={() => onSelect(room)}
      title={`${room.roomName} — ${status}${room.latest?.downloadMbps ? ` (${room.latest.downloadMbps} Mbps)` : ''}`}
      className={`rounded-lg px-2 py-3 text-xs font-medium text-left transition ring-2 ${
        selected ? 'ring-indigo-400' : 'ring-transparent'
      }`}
      style={{ backgroundColor: `${STATUS_COLOR[status]}33`, color: STATUS_COLOR[status] }}
    >
      <div className="truncate">{room.roomName}</div>
      <div className="opacity-70">{room.latest?.downloadMbps ? `${room.latest.downloadMbps} Mbps` : 'no data'}</div>
    </button>
  );
}

export default function FloorPlanView({ onSelectRoom, selectedRoomId }) {
  const [buildings, setBuildings] = useState([]);
  const [heatmap, setHeatmap] = useState([]);

  useEffect(() => {
    api.getBuildings().then(setBuildings).catch(() => {});
    api.getHeatmapLatest().then(setHeatmap).catch(() => {});

    const onUpdate = (payload) => {
      setHeatmap((prev) => {
        const exists = prev.some((r) => r.roomId === payload.roomId);
        if (exists) {
          return prev.map((r) => (r.roomId === payload.roomId ? { ...r, latest: payload } : r));
        }
        return [...prev, { roomId: payload.roomId, roomName: payload.roomName, latest: payload }];
      });
    };
    socket.on('heatmap:update', onUpdate);
    return () => socket.off('heatmap:update', onUpdate);
  }, []);

  const roomsByBuilding = useMemo(() => {
    const heatByRoomId = Object.fromEntries(heatmap.map((h) => [h.roomId, h]));
    return buildings.map((b) => ({
      ...b,
      rooms: b.rooms.map((r) => ({
        roomId: r.id,
        roomName: r.name,
        latest: heatByRoomId[r.id]?.latest || null,
      })),
    }));
  }, [buildings, heatmap]);

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Campus Map</h2>
        <div className="flex gap-3 text-xs text-slate-400">
          {Object.entries(STATUS_COLOR).filter(([k]) => k !== 'UNKNOWN').map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c }} />
              {k}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Tap a room to pre-fill it below in Speed Test. Layout is a grid MVP — swap in a real
        blueprint image later (see README).
      </p>

      {roomsByBuilding.length === 0 && (
        <p className="text-slate-400 text-sm">No buildings seeded yet — run the server's seed script.</p>
      )}

      <div className="space-y-4">
        {roomsByBuilding.map((b) => (
          <div key={b.id}>
            <h3 className="text-sm font-medium text-slate-300 mb-2">{b.name}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {b.rooms.map((r) => (
                <RoomTile
                  key={r.roomId}
                  room={r}
                  selected={selectedRoomId === r.roomId}
                  onSelect={() => onSelectRoom(b.id, r.roomId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
