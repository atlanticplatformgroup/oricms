/**
 * Presence Service - Real-time user presence tracking
 *
 * Uses Socket.IO for WebSocket connections
 * Tracks who's viewing/editing what content
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../auth/middleware';
import { logger } from '../middleware/logger';
import {
  PresenceRoomStore,
  getPresenceRoomKey,
  type PresenceAction,
} from './presence-store';

class PresenceService {
  private io: SocketServer | null = null;
  private readonly rooms = new PresenceRoomStore();

  initialize(server: HttpServer) {
    const corsOrigins = process.env.FRONTEND_URL?.split(',').map((origin) => origin.trim()) || ['http://localhost:5173'];
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

    this.io = new SocketServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (corsOrigins.includes(origin) || (isDevelopment && localhostOriginPattern.test(origin))) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
      },
    });

    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        if (token === 'preview-guest') {
          socket.data.user = { id: 'guest', name: 'Preview Guest', email: 'guest@oricms.com' };
          return next();
        }

        const decoded = verifyToken(token);
        socket.data.user = decoded;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info({ msg: 'Presence user connected', email: socket.data.user?.email, socketId: socket.id });

      socket.on('presence:join', (data: { projectId: string; page: string; action: PresenceAction }) => {
        this.handleJoin(socket, data);
      });

      socket.on('presence:action', (data: { action: PresenceAction }) => {
        this.handleActionChange(socket, data);
      });

      socket.on('presence:leave', () => {
        this.handleLeave(socket);
      });

      socket.on('content:update', (data: { projectId: string; collectionId: string; entryId: string; content: unknown }) => {
        const { projectId, collectionId, entryId, content } = data;
        const roomKey = `preview:${projectId}:${collectionId}:${entryId}`;

        socket.to(roomKey).emit('content:preview', {
          content,
          updatedAt: new Date().toISOString(),
        });
      });

      socket.on('preview:join', (data: { projectId: string; collectionId: string; entryId: string }) => {
        const { projectId, collectionId, entryId } = data;
        const roomKey = `preview:${projectId}:${collectionId}:${entryId}`;
        socket.join(roomKey);
        logger.info({ msg: 'Presence client joined preview room', roomKey, socketId: socket.id });
      });

      socket.on('disconnect', () => {
        this.handleLeave(socket);
        logger.info({ msg: 'Presence user disconnected', email: socket.data.user?.email, socketId: socket.id });
      });
    });

    logger.info({ msg: 'Presence service initialized' });
  }

  private handleJoin(socket: Socket, data: { projectId: string; page: string; action: PresenceAction }) {
    const { projectId, page, action } = data;
    const user = socket.data.user;
    if (!user) return;

    const result = this.rooms.join({
      socketId: socket.id,
      user: {
        id: user.id,
        name: user.name,
      },
      projectId,
      page,
      action,
    });

    if (result.leftRoom) {
      socket.to(result.leftRoom.roomKey).emit('presence:left', {
        user: {
          id: result.leftRoom.user.id,
          name: result.leftRoom.user.name,
        },
      });
      logger.info({
        msg: 'Presence user left room',
        userId: result.leftRoom.user.id,
        name: result.leftRoom.user.name,
        page: result.leftRoom.page,
        socketId: socket.id,
      });
      socket.leave(result.leftRoom.roomKey);
    }

    if (result.kind === 'updated') {
      socket.to(result.roomKey).emit('presence:action', {
        user: {
          id: result.user.id,
          name: result.user.name,
          action: result.user.action,
        },
      });
      return;
    }

    socket.join(result.roomKey);
    socket.to(result.roomKey).emit('presence:joined', {
      user: {
        id: result.user.id,
        name: result.user.name,
        action: result.user.action,
      },
    });
    socket.emit('presence:state', { users: result.otherUsers ?? [] });

    logger.info({
      msg: 'Presence user joined room',
      userId: user.id,
      name: user.name,
      projectId,
      page,
      action,
      socketId: socket.id,
    });
  }

  private handleActionChange(socket: Socket, data: { action: PresenceAction }) {
    const change = this.rooms.changeAction(socket.id, data.action);
    if (!change) {
      return;
    }

    socket.to(change.roomKey).emit('presence:action', {
      user: {
        id: change.user.id,
        name: change.user.name,
        action: change.user.action,
      },
    });

    logger.info({
      msg: 'Presence user action changed',
      userId: change.user.id,
      name: change.user.name,
      page: change.page,
      action: change.user.action,
      socketId: socket.id,
    });
  }

  private handleLeave(socket: Socket) {
    const result = this.rooms.leave(socket.id);
    if (!result) {
      return;
    }

    socket.to(result.roomKey).emit('presence:left', {
      user: {
        id: result.user.id,
        name: result.user.name,
      },
    });
    logger.info({
      msg: 'Presence user left room',
      userId: result.user.id,
      name: result.user.name,
      page: result.page,
      socketId: socket.id,
    });
    socket.leave(result.roomKey);
  }

  getPresence(projectId: string, page: string): { users: Array<{ id: string; name: string; action: string }> } {
    return this.rooms.getPresence(projectId, page);
  }

  broadcastSave(projectId: string, page: string, user: { id: string; name: string }) {
    const roomKey = getPresenceRoomKey(projectId, page);
    this.io?.to(roomKey).emit('content:saved', {
      user,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastChange(projectId: string, collectionId: string, entryId: string, content: unknown) {
    const roomKey = `preview:${projectId}:${collectionId}:${entryId}`;
    this.io?.to(roomKey).emit('content:preview', {
      content,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const presenceService = new PresenceService();
