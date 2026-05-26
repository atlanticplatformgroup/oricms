import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../I18nContext';
import { useI18n } from '../useI18n';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('I18nContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset locale storage mock to return null by default
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('throws when useI18n is used outside provider', () => {
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used within I18nProvider');
  });

  it('defaults to en when no stored locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it('uses stored locale from localStorage', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'oricms:locale') return 'es';
      return null;
    });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('es');
  });

  it('falls back to navigator language for Spanish', () => {
    Object.defineProperty(navigator, 'language', { value: 'es-MX', configurable: true, writable: true });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('es');
  });

  it('translates known keys', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true, writable: true });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('common.loading')).toBe('Loading...');
    expect(result.current.t('auth.signIn')).toBe('Sign In');
  });

  it('falls back to key when translation missing', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('unknown.key')).toBe('unknown.key');
  });

  it('switches locale and persists to localStorage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLocale('es');
    });
    expect(result.current.locale).toBe('es');
    expect(result.current.t('common.loading')).toBe('Cargando...');
    expect(localStorage.setItem).toHaveBeenCalledWith('oricms:locale', 'es');
  });
});
