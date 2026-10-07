import { decode, isBlurhashValid } from 'blurhash';
import { useEffect, useRef } from 'react';

const SIZE = 32;
const MAX_CACHE = 600;
const cache = new Map<string, ImageData>();

function decoded(hash: string): ImageData | null {
  const cached = cache.get(hash);
  if (cached) return cached;
  if (!isBlurhashValid(hash).result) return null;
  const data = new ImageData(new Uint8ClampedArray(decode(hash, SIZE, SIZE)), SIZE, SIZE);
  cache.set(hash, data);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return data;
}

/**
 * Paints a BlurHash into a tiny canvas that CSS stretches over the image area. Decoding a
 * 32×32 hash takes well under a millisecond and results are cached per hash.
 */
export function BlurHashCanvas({ hash, className }: { hash: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const data = decoded(hash);
    if (data) context.putImageData(data, 0, 0);
  }, [hash]);
  return <canvas ref={ref} width={SIZE} height={SIZE} className={className} aria-hidden="true" />;
}
