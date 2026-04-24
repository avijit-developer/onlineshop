const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const connectDB = require('./config/db');
const DriverUser = require('./models/DriverUser');
const Driver = require('./models/Driver');
const { getJwtSecret } = require('./middleware/auth');

const PORT = process.env.PORT || 5000;

async function resolveDriverIdFromPayload(payload) {
  if (!payload || payload.role !== 'driver') return '';
  if (payload.driverId) return String(payload.driverId);

  try {
    const driverUser = await DriverUser.findById(payload.id).select('driver email name').lean();
    if (driverUser?.driver) return String(driverUser.driver);
    if (driverUser?.email) {
      const driver = await Driver.findOne({ email: String(driverUser.email).trim().toLowerCase() }).select('_id').lean();
      if (driver?._id) return String(driver._id);
    }
    if (driverUser?.name) {
      const driver = await Driver.findOne({ name: String(driverUser.name).trim() }).select('_id').lean();
      if (driver?._id) return String(driver._id);
    }
  } catch (error) {
    console.warn('Failed to resolve driver id for socket auth:', error?.message || error);
  }

  return '';
}

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
      Promise.resolve()
        .then(async () => {
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');

        if (!token) {
          throw new Error('Authentication token missing');
        }

        const payload = jwt.verify(token, getJwtSecret());
        if (!['admin', 'vendor', 'driver'].includes(payload.role)) {
          throw new Error('Insufficient permissions');
        }

        if (payload.role === 'driver' && !payload.driverId) {
          payload.driverId = await resolveDriverIdFromPayload(payload);
        }

        socket.user = payload;
        return next();
        })
        .catch(() => next(new Error('Invalid or expired token')));
    });

    io.on('connection', (socket) => {
      socket.join('orders:updates');
      if (socket.user?.role === 'driver' && socket.user.driverId) {
        socket.join(`driver:${socket.user.driverId}`);
      }
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
