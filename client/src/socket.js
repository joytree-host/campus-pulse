import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// WebSocket first: HTTP long-polling sends several separate requests per
// session, which fails ("xhr post error") behind some reverse proxies/edges.
// A single WebSocket connection avoids that; polling stays as a fallback.
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
