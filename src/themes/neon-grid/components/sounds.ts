import { useEffect } from 'react';
import { useUiSounds } from '@/hooks/useUiSounds';

/**
 * Synthesized interface sounds (Web Audio, no sound files): a short tick when the keyboard or
 * remote moves the focus, a rising blip on activation and a falling one for "back". Off unless
 * the user turns them on in the settings.
 */

type Cue = 'move' | 'select' | 'back';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

const CUES: Record<Cue, { from: number; to: number; duration: number; gain: number }> = {
  move: { from: 1800, to: 1800, duration: 0.03, gain: 0.025 },
  select: { from: 880, to: 1760, duration: 0.09, gain: 0.04 },
  back: { from: 1320, to: 660, duration: 0.09, gain: 0.035 },
};

export function playCue(cue: Cue): void {
  const ctx = audio();
  if (!ctx) return;
  const { from, to, duration, gain } = CUES[cue];
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
  volume.gain.setValueAtTime(gain, now);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'XF86Back']);

/** Plays the cues for the whole document while sounds are enabled. */
export function useInterfaceSounds(): void {
  const enabled = useUiSounds();

  useEffect(() => {
    if (!enabled) return;
    const onFocusIn = () => {
      // Pointer users hear clicks only; the tick is feedback for keyboard and remote focus moves.
      if (document.documentElement.dataset.input === 'keyboard') playCue('move');
    };
    const onClick = (event: MouseEvent) => {
      if (
        (event.target as Element | null)?.closest('button, a[href], [role="tab"], [role="radio"]')
      )
        playCue('select');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (BACK_KEYS.has(event.key)) playCue('back');
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
