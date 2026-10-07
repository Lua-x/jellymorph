export type InputModality = 'pointer' | 'keyboard' | 'touch';

const NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Escape',
]);

/**
 * Tracks the last input method in `<html data-input>`, so themes can, for example, hide hover
 * previews on touch or show larger focus rings for remote controls.
 */
export function installInputModality(root: HTMLElement = document.documentElement): () => void {
  const set = (modality: InputModality) => {
    if (root.dataset.input !== modality) root.dataset.input = modality;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (NAVIGATION_KEYS.has(event.key)) set('keyboard');
  };
  const onPointerDown = (event: PointerEvent) => {
    set(event.pointerType === 'touch' ? 'touch' : 'pointer');
  };
  set(window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer');
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
  };
}
