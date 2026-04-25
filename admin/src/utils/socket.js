import { io } from 'socket.io-client';

export const getAdminApiBase = () => {
  const socketBase = process.env.REACT_APP_SOCKET_URL ? String(process.env.REACT_APP_SOCKET_URL).replace(/\/$/, '') : '';
  if (socketBase) return socketBase;

  const envBase = process.env.REACT_APP_API_URL ? String(process.env.REACT_APP_API_URL).replace(/\/$/, '') : '';
  if (envBase) return envBase;

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin.includes('localhost:3000')) {
      return 'http://localhost:5000';
    }
    return origin;
  }

  return 'http://localhost:5000';
};

export const createAdminSocket = () => {
  if (typeof localStorage === 'undefined') return null;

  const token = localStorage.getItem('adminToken');
  if (!token) return null;

  const socketUrl = getAdminApiBase();
  console.info('[socket] admin socket base:', socketUrl);

  const socket = io(socketUrl, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', (error) => {
    console.warn('[socket] admin connect_error:', error?.message || error);
  });

  return socket;
};
