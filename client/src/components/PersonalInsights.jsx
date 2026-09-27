import React, { useEffect, useState } from 'react';

export default function PersonalInsights() {
  const [info, setInfo] = useState({ connectionType: 'unknown', online: navigator.onLine });

  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      setInfo((prev) => ({
        ...prev,
        connectionType: conn.effectiveType || 'unknown',
        downlinkMbps: conn.downlink,
        rttMs: conn.rtt,
      }));
    }
    const onOnline = () => setInfo((p) => ({ ...p, online: true }));
    const onOffline = () => setInfo((p) => ({ ...p, online: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <section className="bg-slate-900 rounded-xl p-5 shadow">
      <h2 className="text-lg font-semibold mb-3">Your Connection</h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-400">Status</dt>
        <dd>{info.online ? 'Online' : 'Offline'}</dd>
        <dt className="text-slate-400">Effective type</dt>
        <dd>{info.connectionType}</dd>
        {info.downlinkMbps !== undefined && (
          <>
            <dt className="text-slate-400">Reported downlink</dt>
            <dd>{info.downlinkMbps} Mbps</dd>
          </>
        )}
        {info.rttMs !== undefined && (
          <>
            <dt className="text-slate-400">Reported RTT</dt>
            <dd>{info.rttMs} ms</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-slate-500 mt-3">
        Browser-reported values (Network Information API) — not all browsers expose these.
      </p>
    </section>
  );
}
