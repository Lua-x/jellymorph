import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockState, resetMockServer } from '@/mocks/node';
import { toCustomPrefs, defaultUserSettings } from '@/settings/schema';
import { useDeviceSettings } from '@/settings/store';
import { useUserSettings } from '@/settings/user-settings';
import { alex, openAs, prepareApp } from '@/test/app';

const SLOW = { timeout: 5000 };
const userId = alex?.id ?? '';

beforeAll(prepareApp);

beforeEach(async () => {
  useUserSettings.getState().deactivate();
  useDeviceSettings.setState({
    language: 'de',
    appearance: { theme: null, colorScheme: 'auto', motion: 'system' },
    deviceMode: 'auto',
  });
  const { changeLanguage } = await import('@/i18n');
  await changeLanguage('de');
});

function savedPrefs(): Record<string, unknown> {
  return (mockState.displayPreferences(userId, 'settings', 'jellymorph').CustomPrefs ??
    {}) as Record<string, unknown>;
}

describe('settings', () => {
  it('applies a color scheme at once and saves it on the server', async () => {
    const user = await openAs('/settings');
    const group = await screen.findByRole('radiogroup', { name: 'Farbschema' }, SLOW);
    await user.click(within(group).getByRole('radio', { name: 'Hell' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.colorScheme).toBe('light');
    }, SLOW);
    await waitFor(() => {
      expect(savedPrefs()['jellymorph.colorScheme']).toBe('light');
    }, SLOW);
    expect(
      await screen.findByText('Gespeichert – auch für deine anderen Geräte'),
    ).toBeInTheDocument();
  });

  it('takes the values saved on the server after signing in', async () => {
    mockState.setDisplayPreferences(userId, 'settings', 'jellymorph', {
      CustomPrefs: toCustomPrefs({
        ...defaultUserSettings('default'),
        language: 'en',
        colorScheme: 'light',
      }),
    });
    await openAs('/settings');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Settings' }, SLOW),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.colorScheme).toBe('light');
    expect(document.documentElement.lang).toBe('en');
  });

  it('changes playback preferences in the Jellyfin user configuration', async () => {
    const user = await openAs('/settings');
    const toggle = await screen.findByRole(
      'switch',
      { name: 'Nächste Folge automatisch abspielen' },
      SLOW,
    );
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }, SLOW);
    await user.click(toggle);
    await waitFor(() => {
      expect(mockState.userConfiguration(userId).EnableNextEpisodeAutoPlay).toBe(false);
    }, SLOW);

    const audio = screen.getByLabelText('Bevorzugte Tonsprache');
    await waitFor(() => {
      expect(within(audio).getByRole('option', { name: 'Japanisch' })).toBeInTheDocument();
    }, SLOW);
    await user.selectOptions(audio, 'jpn');
    await waitFor(() => {
      expect(mockState.userConfiguration(userId).AudioLanguagePreference).toBe('jpn');
    }, SLOW);
  });

  it('offers to try again when saving fails', async () => {
    resetMockServer({ faults: ['preferences'] });
    const user = await openAs('/settings');
    const group = await screen.findByRole('radiogroup', { name: 'Bewegung' }, SLOW);
    await user.click(within(group).getByRole('radio', { name: 'Reduziert' }));
    expect(document.documentElement.dataset.motion).toBe('reduced');

    const alert = await screen.findByRole('alert', {}, SLOW);
    expect(alert).toHaveTextContent(
      'Deine Einstellungen konnten nicht am Server gespeichert werden.',
    );
    mockState.options.faults = [];
    await act(async () => {
      await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }));
    });
    await waitFor(() => {
      expect(savedPrefs()['jellymorph.motion']).toBe('reduced');
    }, SLOW);
  });

  it('switches to the TV mode on this device only', async () => {
    const user = await openAs('/settings');
    const group = await screen.findByRole('radiogroup', { name: 'Bedienmodus' }, SLOW);
    await user.click(within(group).getByRole('radio', { name: 'Fernseher' }));
    expect(document.documentElement.dataset.device).toBe('tv');
    expect(screen.getByRole('slider', { name: 'Bildrand für Fernseher' })).toHaveValue('3');
    expect(useDeviceSettings.getState().deviceMode).toBe('tv');
    expect(savedPrefs()['jellymorph.deviceMode']).toBeUndefined();
  });
});
