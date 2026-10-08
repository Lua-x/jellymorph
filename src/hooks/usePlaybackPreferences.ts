import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchLanguages, savePlaybackPreferences } from '@/api/preferences';
import type { CurrentUser, LanguageOption, PlaybackPreferences, QueryResult } from '@/domain/types';
import { useToasts } from '@/ui/toast-store';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';
import { useCurrentUser } from './useUser';

export interface PlaybackPreferencesModel {
  preferences: QueryResult<PlaybackPreferences>;
  /** Changes the user's Jellyfin configuration (shown at once, undone if saving fails). */
  update: (patch: Partial<PlaybackPreferences>) => void;
}

export function usePlaybackPreferences(): PlaybackPreferencesModel {
  const { t } = useTranslation('settings');
  const { api, key } = useActiveSession();
  const client = useQueryClient();
  const user = useCurrentUser();
  const showToast = useToasts((state) => state.show);

  const preferences: QueryResult<PlaybackPreferences> =
    user.status === 'success'
      ? { status: 'success', data: user.data.playback, isRefreshing: user.isRefreshing }
      : user;

  return {
    preferences,
    update: (patch) => {
      const queryKey = queryKeys.currentUser(key);
      const previous = client.getQueryData<CurrentUser>(queryKey);
      if (previous) {
        client.setQueryData<CurrentUser>(queryKey, {
          ...previous,
          playback: { ...previous.playback, ...patch },
        });
      }
      savePlaybackPreferences(api, key.userId, patch)
        .then((playback) => {
          const current = client.getQueryData<CurrentUser>(queryKey);
          if (current) client.setQueryData<CurrentUser>(queryKey, { ...current, playback });
        })
        .catch(() => {
          if (previous) client.setQueryData(queryKey, previous);
          showToast('error', t('playback.saveFailed'));
        });
    },
  };
}

function localizedNames(languages: LanguageOption[], uiLanguage: string): LanguageOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([uiLanguage], { type: 'language' });
  } catch {
    // Old browsers: keep the server's names.
  }
  return languages
    .map((language) => {
      let name = language.name;
      try {
        if (language.twoLetterCode) name = names?.of(language.twoLetterCode) ?? language.name;
      } catch {
        // Unknown code for Intl: keep the server's name.
      }
      return { ...language, name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, uiLanguage));
}

/** Languages for the audio and subtitle preferences, named in the UI language. */
export function useLanguageOptions(): QueryResult<LanguageOption[]> {
  const { api, key } = useActiveSession();
  const { i18n } = useTranslation();
  const result = toQueryResult(
    useQuery({
      queryKey: queryKeys.languages(key.serverId),
      queryFn: ({ signal }) => fetchLanguages(api, signal),
      staleTime: Infinity,
    }),
  );
  return result.status === 'success'
    ? { ...result, data: localizedNames(result.data, i18n.language) }
    : result;
}
