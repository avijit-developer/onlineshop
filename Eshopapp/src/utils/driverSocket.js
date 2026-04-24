import { io } from 'socket.io-client';
import { API_BASE } from './api';

export const createDriverSocket = (token) => {
  if (!token) return null;

  return io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
  });
};

