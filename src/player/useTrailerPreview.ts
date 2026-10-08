import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getDeviceId } from '@/api/device';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useActiveSession } from '@/hooks/useSession';
import { useDeviceKind } from '@/navigation/device';
import { useUserSettings } from '@/settings/user-settings';

/** The hero must stay calm for this long before a trailer starts. */
const IDLE_MS = 3000;
/** Scrolling further than this stops the preview. */
const SCROLL_LIMIT = 120;

export interface TrailerPreview {
  /** Attach to a muted <video> above the hero backdrop. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The trailer is running (fade the video in, pause the hero rotation). */
  playing: boolean;
  /** Stops the preview, e.g. when the focus leaves the hero. */
  cancel: () => void;
}

function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Plays the local trailer of the hero item muted after a few calm seconds (architecture §9.13).
 * Only when "trailer autoplay" is on, motion is not reduced, data saving is off and the device
 * is not a phone; it stops on scrolling, a hidden tab, `cancel()` and when the item changes.
 */
export function useTrailerPreview(itemId: string | null): TrailerPreview {
  const { api, session } = useActiveSession();
  const autoplay = useUserSettings((state) => state.values?.trailerAutoplay ?? false);
  const motion = useMotionPreference();
  const device = useDeviceKind();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cancelledFor, setCancelledFor] = useState<string | null>(null);
  const userId = session.userId;

  const enabled =
    itemId !== null &&
    cancelledFor !== itemId &&
    autoplay &&
    motion === 'full' &&
    device !== 'touch' &&
    !saveData();

  const cancel = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
    if (itemId) setCancelledFor(itemId);
  }, [itemId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !itemId || !video) return;
    const controller = new AbortController();
    const stop = () => {
      controller.abort();
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
    };
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'visible' || window.scrollY > SCROLL_LIMIT) return;
      // The player code loads only now, not with the home page.
      import('./trailer')
        .then(({ startTrailerPreview }) =>
          startTrailerPreview({
            api,
            userId,
            deviceId: getDeviceId(),
            itemId,
            video,
            signal: controller.signal,
          }),
        )
        .then(
          (stopTrailer) => {
            if (controller.signal.aborted) stopTrailer?.();
            else stopRef.current = stopTrailer;
          },
          () => {
            // No trailer or not playable: the backdrop stays.
          },
        );
    }, IDLE_MS);

    const onPlaying = () => {
      setPlaying(true);
    };
    const onEnded = () => {
      stop();
    };
    const onScroll = () => {
      if (window.scrollY > SCROLL_LIMIT) stop();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') stop();
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      stop();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, itemId, api, userId]);

  return { videoRef, playing, cancel };
}
