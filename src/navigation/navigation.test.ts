import { afterEach, describe, expect, it } from 'vitest';
import { isTvBrowser, resolveDevice } from './device';
import { claimKeys, handleNavigationKey, nearest, score, type Box } from './spatial';

const box = (left: number, top: number, width = 100, height = 60): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe('spatial navigation geometry', () => {
  const origin = box(100, 100);

  it('only considers candidates that lie in the direction', () => {
    expect(score(origin, box(250, 100), 'right')).not.toBeNull();
    expect(score(origin, box(250, 100), 'left')).toBeNull();
    expect(score(origin, box(100, 200), 'down')).not.toBeNull();
    expect(score(origin, box(100, 200), 'up')).toBeNull();
  });

  it('ignores neighbours that are only slightly offset (a lifted, focused card)', () => {
    expect(score(origin, box(210, 104), 'down')).toBeNull();
    expect(score(origin, box(210, 96), 'up')).toBeNull();
  });

  it('prefers the aligned candidate over a closer but misaligned one', () => {
    const aligned = { box: box(100, 260), value: 'aligned' };
    const diagonal = { box: box(400, 180), value: 'diagonal' };
    expect(nearest(origin, 'down', [diagonal, aligned])).toBe('aligned');
  });

  it('picks the candidate whose center is closest among aligned ones', () => {
    const left = { box: box(40, 200), value: 'left' };
    const middle = { box: box(110, 200), value: 'middle' };
    expect(nearest(origin, 'down', [left, middle])).toBe('middle');
  });
});

describe('navigation keys', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function press(key: string, target: HTMLElement) {
    target.focus();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    return handleNavigationKey(event);
  }

  it('leaves ←/→ to text fields until the caret reaches the edge', () => {
    const input = document.createElement('input');
    input.value = 'Abend';
    document.body.append(input);
    input.setSelectionRange(2, 2);
    expect(press('ArrowLeft', input)).toBe(false);
    input.setSelectionRange(0, 0);
    // At the start the field lets go (nothing else to focus here, so nothing moves).
    expect(handleNavigationKey(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe(false);
  });

  it('leaves the value keys of selects and sliders alone', () => {
    const select = document.createElement('select');
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.append(select, slider);
    expect(press('ArrowDown', select)).toBe(false);
    expect(press('ArrowRight', slider)).toBe(false);
  });

  it('does nothing while a screen has claimed the keys (the player)', () => {
    const button = document.createElement('button');
    document.body.append(button);
    window.history.replaceState({ idx: 3 }, '');
    const release = claimKeys();
    expect(press('Escape', button)).toBe(false);
    release();
  });

  it('goes back on Escape only when there is a previous page in the app', () => {
    const button = document.createElement('button');
    document.body.append(button);
    window.history.replaceState({ idx: 0 }, '');
    expect(press('Escape', button)).toBe(false);
    window.history.replaceState({ idx: 2 }, '');
    expect(press('Escape', button)).toBe(true);
  });
});

describe('device kind', () => {
  it('recognizes TV browsers', () => {
    expect(isTvBrowser('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/108.0')).toBe(
      true,
    );
    expect(isTvBrowser('Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36')).toBe(true);
    expect(isTvBrowser('Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/120')).toBe(
      true,
    );
    expect(isTvBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/153.0')).toBe(false);
  });

  it('follows the setting before the detection', () => {
    expect(resolveDevice('tv', 'Windows Chrome', false)).toBe('tv');
    expect(resolveDevice('desktop', 'Tizen SMART-TV', false)).toBe('desktop');
    expect(resolveDevice('auto', 'Tizen SMART-TV', false)).toBe('tv');
    expect(resolveDevice('auto', 'iPhone Safari', true)).toBe('touch');
  });
});
