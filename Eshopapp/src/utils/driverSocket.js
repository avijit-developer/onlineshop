import { io } from 'socket.io-client';
import { API_BASE } from './api';

export const createDriverSocket = (token) => {
  if (!token) return null;

  console.info('[socket] driver socket base:', API_BASE);

  const socket = io(API_BASE, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', (error) => {
    console.warn('[socket] driver connect_error:', error?.message || error);
  });

  return socket;
};
