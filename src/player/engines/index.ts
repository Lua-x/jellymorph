import { createNativeEngine } from './native';
import type { EngineFactory } from './types';

/** Creates an engine; hls.js is a separate chunk that only loads for HLS outside Safari. */
export const createEngine: EngineFactory = async (kind, options) => {
  if (kind === 'native') return createNativeEngine(options);
  const { createHlsEngine } = await import('./hlsjs');
  return createHlsEngine(options);
};

export type { EngineFactory, EngineFailure, EngineKind, PlaybackEngine } from './types';
