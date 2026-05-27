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

export function AuthenticatedImage({ src, alt, ...props }: AuthenticatedImageProps) {
  const source = typeof src === 'string' ? src : '';
  const resolvedUrl = useMemo(() => resolveAssetUrl(source), [source]);
  const imageSrc = resolvedUrl?.toString() || source;

  return <Image src={imageSrc} alt={alt} {...props} />;
}
