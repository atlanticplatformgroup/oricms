import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request, ApiError, API_BASE_URL } from '../core';

describe('core request', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('window', { location: { pathname: '/', href: '' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON data on successful GET', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { id: '1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await request('/test');
    expect(result).toEqual({ id: '1' });
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/test`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends JSON body on POST', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: null }), { status: 200 }),
    );

    await request('/test', { method: 'POST', body: { name: 'value' } });
    const [, init] = mockFetch.mock.calls[0];
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'value' }),
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    });
  });

  it('throws ApiError on non-ok response', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }),
        { status: 404 },
      ),
    );

    await expect(request('/test')).rejects.toBeInstanceOf(ApiError);
  });

  it('retries on network error', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: '2' } }), { status: 200 }),
      );

    const promise = request('/test');
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual({ id: '2' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 500', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, error: { message: 'Internal error', code: 'INTERNAL' } }), { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: '3' } }), { status: 200 }),
      );

    const promise = request('/test');
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual({ id: '3' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('respects requiresAuth false', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: null }), { status: 200 }),
    );

    await request('/public', { requiresAuth: false });
    const [, init] = mockFetch.mock.calls[0];
    expect(init?.headers).not.toHaveProperty('Authorization');
  });
});
