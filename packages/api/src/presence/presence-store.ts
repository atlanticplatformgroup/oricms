export type PresenceAction = 'viewing' | 'editing';

export interface PresenceParticipant {
  id: string;
  name: string;
  action: PresenceAction;
}

interface PresenceUser {
  userId: string;
  name: string;
  socketId: string;
  projectId: string;
  page: string;
  action: PresenceAction;
  joinedAt: Date;
}

interface PresenceRoom {
  projectId: string;
  page: string;
  users: Map<string, PresenceUser>;
}

interface PresenceRoomTransition {
  roomKey: string;
  page: string;
  user: PresenceParticipant;
}

export interface PresenceJoinResult {
  kind: 'joined' | 'updated';
  roomKey: string;
  user: PresenceParticipant;
  otherUsers?: PresenceParticipant[];
  leftRoom?: PresenceRoomTransition;
}

export interface PresenceActionChangeResult {
  roomKey: string;
  page: string;
  user: PresenceParticipant;
}

export interface PresenceLeaveResult {
  roomKey: string;
  page: string;
  user: PresenceParticipant;
}

export function getPresenceRoomKey(projectId: string, page: string): string {
  return `${projectId}:${page}`;
}

export class PresenceRoomStore {
  private readonly rooms = new Map<string, PresenceRoom>();

  join(input: {
    socketId: string;
    user: { id: string; name: string };
    projectId: string;
    page: string;
    action: PresenceAction;
  }): PresenceJoinResult {
    const roomKey = getPresenceRoomKey(input.projectId, input.page);
    const existingRoomKey = this.findRoomKeyBySocket(input.socketId);

    if (existingRoomKey === roomKey) {
      const room = this.rooms.get(roomKey)!;
      const presenceUser = room.users.get(input.socketId)!;
      presenceUser.action = input.action;
      return {
        kind: 'updated',
        roomKey,
        user: toParticipant(presenceUser),
      };
    }

    let leftRoom: PresenceRoomTransition | undefined;
    if (existingRoomKey) {
      leftRoom = this.removeSocketFromRoom(existingRoomKey, input.socketId) ?? undefined;
    }

    const room = this.getOrCreateRoom(input.projectId, input.page);
    const presenceUser: PresenceUser = {
      userId: input.user.id,
      name: input.user.name,
      socketId: input.socketId,
      projectId: input.projectId,
      page: input.page,
      action: input.action,
      joinedAt: new Date(),
    };

    room.users.set(input.socketId, presenceUser);

    const otherUsers = Array.from(room.users.values())
      .filter((user) => user.socketId !== input.socketId)
      .map(toParticipant);

    return {
      kind: 'joined',
      roomKey,
      user: toParticipant(presenceUser),
      otherUsers,
      leftRoom,
    };
  }

  changeAction(socketId: string, action: PresenceAction): PresenceActionChangeResult | null {
    const roomKey = this.findRoomKeyBySocket(socketId);
    if (!roomKey) {
      return null;
    }

    const room = this.rooms.get(roomKey)!;
    const presenceUser = room.users.get(socketId);
    if (!presenceUser) {
      return null;
    }

    presenceUser.action = action;
    return {
      roomKey,
      page: room.page,
      user: toParticipant(presenceUser),
    };
  }

  leave(socketId: string): PresenceLeaveResult | null {
    const roomKey = this.findRoomKeyBySocket(socketId);
    if (!roomKey) {
      return null;
    }

    return this.removeSocketFromRoom(roomKey, socketId);
  }

  getPresence(projectId: string, page: string): { users: PresenceParticipant[] } {
    const room = this.rooms.get(getPresenceRoomKey(projectId, page));
    if (!room) {
      return { users: [] };
    }

    return {
      users: Array.from(room.users.values()).map(toParticipant),
    };
  }

  private findRoomKeyBySocket(socketId: string): string | null {
    for (const [roomKey, room] of this.rooms) {
      if (room.users.has(socketId)) {
        return roomKey;
      }
    }

    return null;
  }

  private getOrCreateRoom(projectId: string, page: string): PresenceRoom {
    const roomKey = getPresenceRoomKey(projectId, page);
    const existing = this.rooms.get(roomKey);
    if (existing) {
      return existing;
    }

    const room: PresenceRoom = {
      projectId,
      page,
      users: new Map(),
    };
    this.rooms.set(roomKey, room);
    return room;
  }

  private removeSocketFromRoom(roomKey: string, socketId: string): PresenceLeaveResult | null {
    const room = this.rooms.get(roomKey);
    const presenceUser = room?.users.get(socketId);
    if (!room || !presenceUser) {
      return null;
    }

    room.users.delete(socketId);
    if (room.users.size === 0) {
      this.rooms.delete(roomKey);
    }

    return {
      roomKey,
      page: room.page,
      user: toParticipant(presenceUser),
    };
  }
}

function toParticipant(user: PresenceUser): PresenceParticipant {
  return {
    id: user.userId,
    name: user.name,
    action: user.action,
  };
}
