import { afterEach, describe, expect, it, vi } from 'vitest';
import { handlePlayerKey } from './keyboard';
import type { PlayerModel } from './model';
import { INITIAL_PLAYER_STATE } from './store';

function player(overrides: Partial<PlayerModel> = {}): PlayerModel {
  return {
    ...INITIAL_PLAYER_STATE,
    status: 'playing',
    volume: 0.5,
    qualities: [],
    rates: [],
    canFullscreen: true,
    canPictureInPicture: false,
    controlsVisible: false,
    revealControls: vi.fn(),
    holdControls: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    seekBy: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setRate: vi.fn(),
    selectAudio: vi.fn(),
    selectSubtitle: vi.fn(),
    setBurnInStyled: vi.fn(),
    setMaxBitrate: vi.fn(),
    skipSegment: vi.fn(),
    playNext: vi.fn(),
    cancelNext: vi.fn(),
    toggleFullscreen: vi.fn(),
    togglePictureInPicture: vi.fn(),
    retry: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

function setup() {
  const stage = document.createElement('main');
  const button = document.createElement('button');
  button.textContent = 'Pause';
  const slider = document.createElement('div');
  slider.setAttribute('role', 'slider');
  slider.tabIndex = 0;
  stage.append(button, slider);
  document.body.append(stage);
  return { stage, button, slider };
}

function press(key: string, target: EventTarget, model: PlayerModel, stage: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return handlePlayerKey(event, model, stage);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('player keys', () => {
  it('plays and pauses with Space and K, wherever the focus is while controls are hidden', () => {
    const { stage, button } = setup();
    const model = player();
    expect(press(' ', document.body, model, stage)).toBe(true);
    expect(press('k', button, model, stage)).toBe(true);
    expect(model.togglePlay).toHaveBeenCalledTimes(2);
  });

  it('leaves Space to a focused button while the controls are visible', () => {
    const { stage, button } = setup();
    const model = player({ controlsVisible: true });
    expect(press(' ', button, model, stage)).toBe(false);
    expect(model.togglePlay).not.toHaveBeenCalled();
  });

  it('seeks and changes the volume with the arrows while the controls are hidden', () => {
    const { stage } = setup();
    const model = player();
    press('ArrowLeft', document.body, model, stage);
    press('ArrowRight', document.body, model, stage);
    press('ArrowUp', document.body, model, stage);
    expect(model.seekBy).toHaveBeenCalledWith(-10);
    expect(model.seekBy).toHaveBeenCalledWith(10);
    expect(model.setVolume).toHaveBeenCalledWith(0.6);
    expect(model.revealControls).toHaveBeenCalled();
  });

  it('leaves ← and → to the timeline slider while it has focus', () => {
    const { stage, slider } = setup();
    const model = player({ controlsVisible: true });
    expect(press('ArrowRight', slider, model, stage)).toBe(false);
    expect(model.seekBy).not.toHaveBeenCalled();
  });

  it('first brings back hidden controls on Enter (remote controls)', () => {
    const { stage } = setup();
    const model = player();
    press('Enter', document.body, model, stage);
    expect(model.revealControls).toHaveBeenCalled();
    expect(model.togglePlay).not.toHaveBeenCalled();
  });

  it('closes the player with Escape and the back keys of TV remotes', () => {
    const { stage } = setup();
    const model = player();
    press('Escape', document.body, model, stage);
    press('GoBack', document.body, model, stage);
    expect(model.close).toHaveBeenCalledTimes(2);
  });

  it('handles media keys and full screen', () => {
    const { stage } = setup();
    const model = player({ nextUp: { item: {} as PlayerModel['item'] & object, countdown: 5 } });
    press('MediaPause', document.body, model, stage);
    press('MediaTrackNext', document.body, model, stage);
    press('f', document.body, model, stage);
    expect(model.togglePlay).toHaveBeenCalledTimes(1);
    expect(model.playNext).toHaveBeenCalled();
    expect(model.toggleFullscreen).toHaveBeenCalled();
  });

  it('ignores keys that were already handled or typed into a field', () => {
    const { stage } = setup();
    const input = document.createElement('input');
    stage.append(input);
    const model = player();
    expect(press('k', input, model, stage)).toBe(false);
    const handled = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    handled.preventDefault();
    expect(handlePlayerKey(handled, model, stage)).toBe(false);
  });
});
