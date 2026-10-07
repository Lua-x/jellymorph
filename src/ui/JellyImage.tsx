import { useState, type ReactNode } from 'react';
import type { ImageRef } from '@/domain/types';
import { BlurHashCanvas } from './BlurHashCanvas';
import { sizedImageUrl } from './image-url';
import styles from './JellyImage.module.css';

/** Widths requested from the Jellyfin image API; the browser picks one via srcset/sizes. */
const WIDTHS = [160, 240, 360, 480, 640, 960, 1280, 1920, 2560, 3840];

interface JellyImageProps {
  image: ImageRef | null;
  /** `sizes` attribute describing the rendered width, e.g. "(min-width: 60rem) 15vw, 45vw". */
  sizes: string;
  alt?: string;
  className?: string;
  /** Largest width ever needed (cards never need 4K). */
  maxWidth?: number;
  /** Above-the-fold image: load immediately with high priority. */
  priority?: boolean;
  fit?: 'cover' | 'contain';
  /** Shown when there is no image or it fails to load. */
  fallback?: ReactNode;
}

/**
 * A server image with BlurHash placeholder, responsive sizes and lazy loading. Fills its
 * parent; the parent defines the aspect ratio so nothing shifts while loading.
 */
export function JellyImage({
  image,
  sizes,
  alt = '',
  className,
  maxWidth = 3840,
  priority = false,
  fit = 'cover',
  fallback,
}: JellyImageProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url ?? null;
  const failed = url !== null && failedUrl === url;
  const widths = WIDTHS.filter((width) => width <= maxWidth);

  return (
    <span className={[styles.frame, className].filter(Boolean).join(' ')}>
      {image?.blurHash && !failed && fit === 'cover' && (
        <BlurHashCanvas hash={image.blurHash} className={styles.placeholder} />
      )}
      {url && !failed && (
        <img
          className={[
            styles.image,
            fit === 'contain' ? styles.contain : '',
            loadedUrl === url ? styles.loaded : '',
          ]
            .filter(Boolean)
            .join(' ')}
          src={sizedImageUrl(url, widths[Math.min(3, widths.length - 1)] ?? maxWidth)}
          srcSet={widths
            .map((width) => `${sizedImageUrl(url, width)} ${String(width)}w`)
            .join(', ')}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          ref={(element) => {
            // Cached images may finish before React attaches onLoad.
            if (element?.complete && element.naturalWidth > 0) setLoadedUrl(url);
          }}
          onLoad={() => {
            setLoadedUrl(url);
          }}
          onError={() => {
            setFailedUrl(url);
          }}
        />
      )}
      {(!url || failed) && fallback}
    </span>
  );
}
