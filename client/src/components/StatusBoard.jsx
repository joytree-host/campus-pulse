import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { socket } from '../socket';

const DOT = {
  UP: 'bg-emerald-400',
  DOWN: 'bg-rose-500',
};

export default function StatusBoard() {
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    api.getStatus().then(setStatuses).catch(() => {});
    const onUpdate = (results) => setStatuses(results);
    socket.on('status:update', onUpdate);
    return () => socket.off('status:update', onUpdate);
  }, []);

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <h2 className="text-lg font-semibold mb-3">Service Status</h2>
      {statuses.length === 0 && (
        <p className="text-slate-400 text-sm">
          No status targets configured yet — add some to `STATUS_TARGETS` in the server .env.
        </p>
      )}
      <ul className="space-y-2">
        {statuses.map((s) => (
          <li key={s.name} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${DOT[s.status] || 'bg-slate-500'}`} />
              <span className="font-medium">{s.name}</span>
            </div>
            <span className="text-sm text-slate-400">
              {s.status}{s.latencyMs ? ` · ${Math.round(s.latencyMs)}ms` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
