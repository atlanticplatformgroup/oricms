import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requestLogger } from '../logger';

describe('Request Logger Middleware', () => {
  function createMockResponse(): Response {
    const listeners: Record<string, Array<() => void>> = {};
    return {
      statusCode: 200,
      on: vi.fn((event: string, handler: () => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
        return {} as any;
      }),
      emit: vi.fn((event: string) => {
        listeners[event]?.forEach((handler) => handler());
        return true;
      }),
    } as unknown as Response;
  }

  it('attaches a requestId to the request', () => {
    const req = { headers: {}, params: {} } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(next).toHaveBeenCalled();
  });

  it('preserves existing requestId', () => {
    const req = { headers: {}, params: {}, requestId: 'existing-id' } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(req.requestId).toBe('existing-id');
    expect(next).toHaveBeenCalled();
  });

  it('logs request details on response finish', () => {
    const req = { headers: {}, params: {}, method: 'GET', path: '/test', userId: 'user-1' } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn();

    requestLogger(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
