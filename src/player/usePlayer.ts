import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { getDeviceId } from '@/api/device';
import type { CurrentUser, MediaItem } from '@/domain/types';
import { queryKeys } from '@/hooks/query-keys';
import { useActiveSession } from '@/hooks/useSession';
import { useDeviceSettings } from '@/settings/store';
import { PlaybackController } from './controller';
import type { EngineFactory } from './engines';
import { handlePlayerKey } from './keyboard';
import { PLAYBACK_RATES, QUALITY_OPTIONS, type PlayerModel } from './model';
import { createPlayerStore, INITIAL_PLAYER_STATE } from './store';

/** Controls fade out after this long without input while the video plays. */
const HIDE_CONTROLS_MS = 3500;

const CAN_FULLSCREEN =
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled || 'webkitEnterFullscreen' in HTMLVideoElement.prototype);
const CAN_PICTURE_IN_PICTURE = typeof document !== 'undefined' && document.pictureInPictureEnabled;

export interface UsePlayerOptions {
  itemId: string;
  startSeconds: number;
  onClose: () => void;
  onPlayNext: (item: MediaItem, startSeconds: number) => void;
  /** Test seam: replaces the media engines. */
  createEngine?: EngineFactory;
}

export interface PlayerBindings {
  model: PlayerModel;
  videoRef: RefObject<HTMLVideoElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  freezeRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Connects a PlaybackController to the player screen: creates it for the item, exposes its
 * state as a PlayerModel and handles keyboard input and the auto-hiding controls.
 */
export function usePlayer(options: UsePlayerOptions): PlayerBindings {
  const { itemId, startSeconds, createEngine } = options;
  const { api, session } = useActiveSession();
  const { serverId, userId } = session;
  const queryClient = useQueryClient();
  const [store] = useState(createPlayerStore);
  const state = useStore(store);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const freezeRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PlaybackController | null>(null);
  const callbacks = useRef(options);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [recentlyActive, setRecentlyActive] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    callbacks.current = options;
  });

  const revealControls = useCallback(() => {
    setRecentlyActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setRecentlyActive(false);
    }, HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage) return;
    store.setState(INITIAL_PLAYER_STATE);
    const key = { serverId, userId };
    const controller = new PlaybackController({
      api,
      userId,
      deviceId: getDeviceId(),
      itemId,
      startSeconds,
      video,
      stage,
      freezeCanvas: freezeRef.current,
      store,
      preferences: useDeviceSettings.getState().player,
      autoplayNext: () =>
        queryClient.getQueryData<CurrentUser>(queryKeys.currentUser(key))?.nextEpisodeAutoplay ??
        true,
      onPreferencesChange: (patch) => {
        useDeviceSettings.getState().setPlayer(patch);
      },
      onFinished: () => {
        callbacks.current.onClose();
      },
      onPlayNext: (item, start) => {
        callbacks.current.onPlayNext(item, start);
      },
      onStopped: () => {
        // Progress, "continue watching" and "next up" changed on the server.
        void queryClient.invalidateQueries({ queryKey: queryKeys.user(key) });
      },
      createEngine,
    });
    controllerRef.current = controller;
    const unsubscribe = store.subscribe((next, previous) => {
      if (next.status === 'playing' && previous.status !== 'playing') revealControls();
    });
    void controller.start();
    return () => {
      unsubscribe();
      controllerRef.current = null;
      void controller.destroy();
    };
  }, [
    api,
    serverId,
    userId,
    itemId,
    startSeconds,
    store,
    queryClient,
    createEngine,
    revealControls,
  ]);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
    },
    [],
  );

  const model: PlayerModel = {
    ...state,
    qualities: QUALITY_OPTIONS,
    rates: PLAYBACK_RATES,
    canFullscreen: CAN_FULLSCREEN,
    canPictureInPicture: CAN_PICTURE_IN_PICTURE,
    controlsVisible: recentlyActive || held || state.status !== 'playing' || state.nextUp !== null,
    revealControls,
    holdControls: (hold) => {
      setHeld(hold);
      if (!hold) revealControls();
    },
    togglePlay: () => {
      controllerRef.current?.togglePlay();
    },
    seek: (seconds) => controllerRef.current?.seek(seconds),
    seekBy: (delta) => controllerRef.current?.seekBy(delta),
    setVolume: (volume) => controllerRef.current?.setVolume(volume),
    toggleMute: () => {
      controllerRef.current?.toggleMute();
    },
    setRate: (rate) => controllerRef.current?.setRate(rate),
    selectAudio: (index) => controllerRef.current?.selectAudio(index),
    selectSubtitle: (index) => controllerRef.current?.selectSubtitle(index),
    setBurnInStyled: (enabled) => controllerRef.current?.setBurnInStyled(enabled),
    setMaxBitrate: (maxBitrate) => controllerRef.current?.setMaxBitrate(maxBitrate),
    skipSegment: () => {
      controllerRef.current?.skipSegment();
    },
    playNext: () => {
      controllerRef.current?.playNext();
    },
    cancelNext: () => {
      controllerRef.current?.cancelNext();
    },
    toggleFullscreen: () => {
      controllerRef.current?.toggleFullscreen();
    },
    togglePictureInPicture: () => {
      controllerRef.current?.togglePictureInPicture();
    },
    retry: () => {
      controllerRef.current?.retry();
    },
    close: () => {
      callbacks.current.onClose();
    },
  };

  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const stage = stageRef.current;
      if (stage && handlePlayerKey(event, modelRef.current, stage)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return { model, videoRef, stageRef, freezeRef };
}
