import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../config/logger.js';

let io: SocketIOServer | null = null;

export function initializeSockets(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('join:room', (room: string) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function broadcast(room: string, event: string, data: any) {
  if (io) {
    io.to(room).emit(event, data);
  }
}
