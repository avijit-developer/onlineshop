import { io } from 'socket.io-client';
import { API_BASE } from './api';

export const createDriverSocket = (token) => {
  if (!token) return null;

  console.info('[socket] driver socket base:', API_BASE);
  console.info('[socket] driver token present:', Boolean(token));

  const socket = io(API_BASE, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.info('[socket] driver connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.warn('[socket] driver connect_error:', error?.message || error);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket] driver disconnected:', reason);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.info('[socket] driver reconnect_attempt:', attempt);
  });

  socket.on('reconnect', (attempt) => {
    console.info('[socket] driver reconnected:', attempt, socket.id);
  });

  return socket;
};
