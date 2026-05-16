/**
 * usePresence Hook - Real-time presence tracking
 * 
 * Usage:
 * const { users, isConnected, updateAction } = usePresence(projectId, pagePath);
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/useAuth';
import { API_BASE_URL } from '../lib/api/core';

interface PresenceUser {
  id: string;
  name: string;
  action: 'viewing' | 'editing';
}

interface UsePresenceReturn {
  users: PresenceUser[];
  isConnected: boolean;
  updateAction: (action: 'viewing' | 'editing') => void;
  emitContentUpdate: (collectionId: string, entryId: string, content: any) => void;
  currentUserAction: 'viewing' | 'editing';
}

export function usePresence(projectId: string | undefined, page: string): UsePresenceReturn {
  const { token } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAction, setCurrentAction] = useState<'viewing' | 'editing'>('viewing');
  const socketRef = useRef<Socket | null>(null);
  const realtimeOrigin = useMemo(() => new URL(API_BASE_URL, window.location.origin).origin, []);

  const tokenRef = useRef(token);
  
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!projectId || !page || !tokenRef.current) {
      return;
    }

    // Connect to presence service
    const socket = io(realtimeOrigin, {
      auth: { token: tokenRef.current },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);

      // Join room
      socket.emit('presence:join', {
        projectId,
        page,
        action: 'viewing',
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receive current room state
    socket.on('presence:state', (data: { users: PresenceUser[] }) => {
      setUsers(data.users);
    });

    // Someone joined
    socket.on('presence:joined', (data: { user: PresenceUser }) => {
      setUsers(prev => {
        if (prev.find(u => u.id === data.user.id)) {
          return prev;
        }
        return [...prev, data.user];
      });
    });

    // Someone left
    socket.on('presence:left', (data: { user: { id: string } }) => {
      setUsers(prev => prev.filter(u => u.id !== data.user.id));
    });

    // Someone changed action
    socket.on('presence:action', (data: { user: PresenceUser }) => {
      setUsers(prev =>
        prev.map(u => (u.id === data.user.id ? data.user : u))
      );
    });

    // Content was saved by someone else
    socket.on('content:saved', (_data: { user: { id: string; name: string }; timestamp: string }) => {
      // Reserved for future collaboration cues.
    });

    // Cleanup
    return () => {
      socket.emit('presence:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [page, projectId, realtimeOrigin]); // Exclude token to prevent reconnect loops

  const updateAction = useCallback((action: 'viewing' | 'editing') => {
    setCurrentAction(action);
    socketRef.current?.emit('presence:action', { action });
  }, []);

  const emitContentUpdate = useCallback((collectionId: string, entryId: string, content: any) => {
    if (!projectId) return;
    socketRef.current?.emit('content:update', {
      projectId,
      collectionId,
      entryId,
      content,
    });
  }, [projectId]);

  return {
    users,
    isConnected,
    updateAction,
    emitContentUpdate,
    currentUserAction: currentAction,
  };
}
