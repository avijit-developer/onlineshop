const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const connectDB = require('./config/db');
const { getJwtSecret } = require('./middleware/auth');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: true,
        credentials: true,
      },
    });

    io.use((socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');

        if (!token) {
          return next(new Error('Authentication token missing'));
        }

        const payload = jwt.verify(token, getJwtSecret());
        if (!['admin', 'vendor'].includes(payload.role)) {
          return next(new Error('Insufficient permissions'));
        }

        socket.user = payload;
        return next();
      } catch (error) {
        return next(new Error('Invalid or expired token'));
      }
    });

    io.on('connection', (socket) => {
      socket.join('orders:updates');
    });

    app.set('io', io);

    server.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
