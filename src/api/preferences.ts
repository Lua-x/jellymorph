/**
 * Server side of the settings: DisplayPreferences for Jellymorph's own values and the user's
 * Jellyfin configuration for playback preferences shared with other clients (§10).
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { SubtitlePlaybackMode } from '@jellyfin/sdk/lib/generated-client/models/subtitle-playback-mode';
import type { DisplayPreferencesDto } from '@jellyfin/sdk/lib/generated-client/models/display-preferences-dto';
import { getDisplayPreferenceApi } from '@jellyfin/sdk/lib/utils/api/display-preference-api';
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type { LanguageOption, PlaybackPreferences, SubtitleMode } from '@/domain/types';

/** Where Jellymorph keeps its own values: DisplayPreferences "settings" of client "jellymorph". */
const DISPLAY_PREFERENCES = { displayPreferencesId: 'settings', client: 'jellymorph' } as const;

export type CustomPrefs = Record<string, string | null | undefined>;

/** The stored DisplayPreferences (the base for saving, so values of other versions survive). */
export async function fetchDisplayPreferences(
  api: Api,
  userId: string,
  signal?: AbortSignal,
): Promise<DisplayPreferencesDto> {
  const { data } = await getDisplayPreferenceApi(api).getDisplayPreferences(
    { ...DISPLAY_PREFERENCES, userId },
    { signal },
  );
  return data;
}

/**
 * Writes our values on top of `base`. No read before the write, so a save still works with
 * `keepalive` while the page closes.
 */
export async function saveDisplayPreferences(
  api: Api,
  userId: string,
  base: DisplayPreferencesDto,
  prefs: Record<string, string>,
  options: { keepalive?: boolean } = {},
): Promise<DisplayPreferencesDto> {
  const dto: DisplayPreferencesDto = {
    ...base,
    Client: DISPLAY_PREFERENCES.client,
    CustomPrefs: { ...base.CustomPrefs, ...prefs },
  };
  await getDisplayPreferenceApi(api).updateDisplayPreferences(
    { ...DISPLAY_PREFERENCES, userId, displayPreferencesDto: dto },
    options.keepalive ? { fetchOptions: { keepalive: true } } : undefined,
  );
  return dto;
}

const SUBTITLE_MODES: Record<SubtitlePlaybackMode, SubtitleMode> = {
  Default: 'default',
  Always: 'always',
  OnlyForced: 'onlyForced',
  None: 'none',
  Smart: 'smart',
};

const SERVER_SUBTITLE_MODES = Object.fromEntries(
  Object.entries(SUBTITLE_MODES).map(([server, mode]) => [mode, server]),
) as Record<SubtitleMode, SubtitlePlaybackMode>;

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

export function toPlaybackPreferences(
  configuration:
    | {
        AudioLanguagePreference?: string | null;
        SubtitleLanguagePreference?: string | null;
        SubtitleMode?: SubtitlePlaybackMode;
        EnableNextEpisodeAutoPlay?: boolean;
      }
    | null
    | undefined,
): PlaybackPreferences {
  return {
    // Jellyfin stores "no preference" as an empty string.
    audioLanguage: emptyToNull(configuration?.AudioLanguagePreference),
    subtitleLanguage: emptyToNull(configuration?.SubtitleLanguagePreference),
    subtitleMode: configuration?.SubtitleMode
      ? SUBTITLE_MODES[configuration.SubtitleMode]
      : 'default',
    nextEpisodeAutoplay: configuration?.EnableNextEpisodeAutoPlay ?? true,
  };
}

/**
 * Changes playback preferences in the user's Jellyfin configuration. The endpoint replaces the
 * whole configuration, so the current one is read first.
 */
export async function savePlaybackPreferences(
  api: Api,
  userId: string,
  patch: Partial<PlaybackPreferences>,
): Promise<PlaybackPreferences> {
  const users = getUserApi(api);
  const { data: user } = await users.getCurrentUser();
  const configuration = { ...user.Configuration };
  if (patch.audioLanguage !== undefined)
    configuration.AudioLanguagePreference = patch.audioLanguage ?? '';
  if (patch.subtitleLanguage !== undefined)
    configuration.SubtitleLanguagePreference = patch.subtitleLanguage ?? '';
  if (patch.subtitleMode !== undefined)
    configuration.SubtitleMode = SERVER_SUBTITLE_MODES[patch.subtitleMode];
  if (patch.nextEpisodeAutoplay !== undefined)
    configuration.EnableNextEpisodeAutoPlay = patch.nextEpisodeAutoplay;
  await users.updateUserConfiguration({ userId, userConfiguration: configuration });
  return toPlaybackPreferences(configuration);
}

/** Languages the server knows (for audio and subtitle preferences), sorted by name. */
export async function fetchLanguages(api: Api, signal?: AbortSignal): Promise<LanguageOption[]> {
  const { data } = await getLocalizationApi(api).getCultures({ signal });
  const seen = new Set<string>();
  return data
    .map((culture) => ({
      code: culture.ThreeLetterISOLanguageName ?? '',
      twoLetterCode: culture.TwoLetterISOLanguageName ?? null,
      name: culture.DisplayName ?? culture.Name ?? '',
    }))
    .filter((language) => {
      if (!language.code || !language.name || seen.has(language.code)) return false;
      seen.add(language.code);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
