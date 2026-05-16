import { useMemo } from 'react';
import { Image } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';
import type { ImageProps } from '@mantine/core';
import { API_BASE_URL } from '../../lib/api/core';

type AuthenticatedImageProps = Omit<ImageProps, 'src'> & Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
  src?: string | null;
};

function resolveAssetUrl(src: string): URL | null {
  if (!src) return null;

  try {
    const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return /^https?:\/\//i.test(src) ? new URL(src) : new URL(src, base);
  } catch {
    return null;
  }
}

function isProtectedAssetUrl(url: URL | null): boolean {
  return Boolean(url?.pathname.startsWith('/api/v1/projects/'));
}

function withToken(url: URL | null, token: string | null): string | undefined {
  if (!url) return undefined;
  if (!token || !isProtectedAssetUrl(url)) return url.toString();

  const next = new URL(url.toString());
  if (!next.searchParams.has('token')) {
    next.searchParams.set('token', token);
  }
  return next.toString();
}

export function AuthenticatedImage({ src, alt, ...props }: AuthenticatedImageProps) {
  const source = typeof src === 'string' ? src : '';
  const resolvedUrl = useMemo(() => resolveAssetUrl(source), [source]);
  const isProtected = isProtectedAssetUrl(resolvedUrl);
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
  const tokenizedSrc = useMemo(() => withToken(resolvedUrl, token), [resolvedUrl, token]);
  const imageSrc = isProtected ? tokenizedSrc : tokenizedSrc || source;

  return <Image src={imageSrc} alt={alt} {...props} />;
}
