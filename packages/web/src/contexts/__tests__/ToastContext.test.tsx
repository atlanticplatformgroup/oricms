import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';
import { notifications } from '@mantine/notifications';

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
    hide: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when useToast is used outside provider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider');
  });

  it('provides showToast and removeToast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.showToast).toBe('function');
    expect(typeof result.current.removeToast).toBe('function');
  });

  it('shows an info toast with default duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.showToast('Hello world');
    expect(notifications.show).toHaveBeenCalledOnce();
    const call = (notifications.show as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.message).toBe('Hello world');
    expect(call.color).toBe('blue');
    expect(call.autoClose).toBe(3000);
    expect(call.id).toBeTypeOf('string');
  });

  it('shows a success toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.showToast('Saved', 'success');
    const call = (notifications.show as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.color).toBe('green');
    expect(call.autoClose).toBe(3000);
  });

  it('shows an error toast with longer duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.showToast('Failed', 'error');
    const call = (notifications.show as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.color).toBe('red');
    expect(call.autoClose).toBe(5000);
  });

  it('shows a warning toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.showToast('Careful', 'warning');
    const call = (notifications.show as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.color).toBe('yellow');
  });

  it('accepts custom duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.showToast('Quick', 'info', { duration: 1000 });
    const call = (notifications.show as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.autoClose).toBe(1000);
  });

  it('removes a toast by id', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.removeToast('toast-123');
    expect(notifications.hide).toHaveBeenCalledWith('toast-123');
  });
});
