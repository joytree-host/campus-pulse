const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  getStatus: () => request('/api/status'),
  getBuildings: () => request('/api/locations'),
  addRoom: (buildingId, name) =>
    request(`/api/locations/${buildingId}/rooms`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  submitSpeedTest: (payload) =>
    request('/api/heatmap', { method: 'POST', body: JSON.stringify(payload) }),
  getHeatmapLatest: () => request('/api/heatmap/latest'),
};
