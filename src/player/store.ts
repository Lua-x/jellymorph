import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PlayerState } from './model';

export const INITIAL_PLAYER_STATE: PlayerState = {
  item: null,
  status: 'loading',
  error: null,
  adapting: false,
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  volume: 1,
  muted: false,
  rate: 1,
  audioTracks: [],
  subtitleTracks: [],
  audioIndex: null,
  subtitleIndex: null,
  burnInStyled: false,
  maxBitrate: null,
  playMethod: null,
  chapters: [],
  trickplay: null,
  segment: null,
  nextUp: null,
  fullscreen: false,
  pictureInPicture: false,
};

export type PlayerStore = StoreApi<PlayerState>;

/** One store per player screen; the controller writes, the overlay reads. */
export function createPlayerStore(): PlayerStore {
  return createStore<PlayerState>()(() => INITIAL_PLAYER_STATE);
}
