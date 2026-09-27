import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { socket } from '../socket';

const BADGE = {
  ONLINE: 'bg-emerald-500/20 text-emerald-400',
  CONGESTED: 'bg-amber-500/20 text-amber-400',
  DOWN: 'bg-rose-500/20 text-rose-400',
};

export default function Heatmap() {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    api.getHeatmapLatest().then(setRooms).catch(() => {});

    const onUpdate = (payload) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.roomId === payload.roomId
            ? { ...r, latest: payload }
            : r
        )
      );
    };
    socket.on('heatmap:update', onUpdate);
    return () => socket.off('heatmap:update', onUpdate);
  }, []);

  const sorted = [...rooms].sort((a, b) => {
    const av = a.latest?.downloadMbps ?? -1;
    const bv = b.latest?.downloadMbps ?? -1;
    return bv - av;
  });

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <h2 className="text-lg font-semibold mb-3">Wi-Fi Heatmap</h2>
      {sorted.length === 0 && (
        <p className="text-slate-400 text-sm">No speed tests logged yet — be the first to run one.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left">
            <tr>
              <th className="py-2">Room</th>
              <th className="py-2">Building</th>
              <th className="py-2">Speed</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.roomId} className="border-t border-slate-800">
                <td className="py-2">{r.roomName}</td>
                <td className="py-2 text-slate-400">{r.building}</td>
                <td className="py-2">{r.latest?.downloadMbps ?? '—'} Mbps</td>
                <td className="py-2">
                  {r.latest?.statusFlag ? (
                    <span className={`px-2 py-0.5 rounded text-xs ${BADGE[r.latest.statusFlag]}`}>
                      {r.latest.statusFlag}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
