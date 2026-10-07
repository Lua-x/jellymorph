import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = Date.now();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  return now;
}

/** Current time in ms, updated once per second while any component uses it. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Whole seconds left until `deadline`, never negative. */
export function useSecondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - useNow()) / 1000));
}
