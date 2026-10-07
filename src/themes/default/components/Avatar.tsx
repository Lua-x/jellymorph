import { useState, type CSSProperties } from 'react';
import styles from './Avatar.module.css';

/** Stable hue per name, so a user keeps the same color everywhere. */
function hueFor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]?.[0], parts.at(-1)?.[0]] : [name.trim()[0]];
  return letters.filter(Boolean).join('').toUpperCase();
}

interface AvatarProps {
  name: string;
  imageUrl: string | null;
  size?: 'sm' | 'lg';
  className?: string;
}

export function Avatar({ name, imageUrl, size = 'sm', className }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = imageUrl !== null && failedUrl !== imageUrl;
  return (
    <span
      className={[styles.avatar, styles[size], className].filter(Boolean).join(' ')}
      style={{ '--avatar-hue': hueFor(name) } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.initials}>{initials(name)}</span>
      {showImage && (
        <img
          className={styles.image}
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            setFailedUrl(imageUrl);
          }}
        />
      )}
    </span>
  );
}
