/**
 * Route chunks that can be loaded ahead of time, e.g. the player when "Play" gets focus. The
 * router registers the loaders, so hooks and themes can trigger them without importing routes.
 */
export type PreloadTarget = 'player';

const loaders = new Map<PreloadTarget, () => Promise<unknown>>();
const started = new Set<PreloadTarget>();

export function registerPreload(target: PreloadTarget, loader: () => Promise<unknown>): void {
  loaders.set(target, loader);
}

export function preload(target: PreloadTarget): void {
  const loader = loaders.get(target);
  if (!loader || started.has(target)) return;
  started.add(target);
  loader().catch(() => {
    // Try again next time; the real navigation reports errors.
    started.delete(target);
  });
}
