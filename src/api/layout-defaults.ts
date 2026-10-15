/**
 * The administrator's default arrangement for everybody (phase 14). Jellyfin has no store that
 * every user can read but only administrators can write, so the default is copied into each
 * user's own DisplayPreferences document "jellymorph-defaults": administrators may write other
 * users' preferences (RequestHelpers.GetUserId), everybody reads only their own copy. The users'
 * own settings live in a different document and are never touched.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { DisplayPreferencesDto } from '@jellyfin/sdk/lib/generated-client/models/display-preferences-dto';
import { getDisplayPreferenceApi } from '@jellyfin/sdk/lib/utils/api/display-preference-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { layoutFromJson, layoutToJson, type Layout } from '@/domain/layout';

const DOCUMENT = { displayPreferencesId: 'jellymorph-defaults', client: 'jellymorph' } as const;
const LAYOUT_KEY = 'jellymorph.layout';
/** When the default was saved (ISO time): newer copies win, older ones get replaced. */
const VERSION_KEY = 'jellymorph.layoutVersion';

export interface LayoutDefaults {
  layout: Layout;
  /** null when no administrator has set a default yet. */
  version: string | null;
}

interface StoredDefaults extends LayoutDefaults {
  dto: DisplayPreferencesDto;
}

async function fetchDocument(
  api: Api,
  userId: string,
  signal?: AbortSignal,
): Promise<StoredDefaults> {
  const { data } = await getDisplayPreferenceApi(api).getDisplayPreferences(
    { ...DOCUMENT, userId },
    { signal },
  );
  const version = data.CustomPrefs?.[VERSION_KEY];
  return {
    dto: data,
    layout: layoutFromJson(data.CustomPrefs?.[LAYOUT_KEY]),
    // Empty after an administrator removed the default.
    version: typeof version === 'string' && version !== '' ? version : null,
  };
}

/** The signed-in user's copy of the default. */
export async function fetchLayoutDefaults(
  api: Api,
  userId: string,
  signal?: AbortSignal,
): Promise<LayoutDefaults> {
  const { layout, version } = await fetchDocument(api, userId, signal);
  return { layout, version };
}

async function writeDocument(
  api: Api,
  userId: string,
  base: DisplayPreferencesDto,
  defaults: LayoutDefaults,
) {
  const dto: DisplayPreferencesDto = {
    ...base,
    Client: DOCUMENT.client,
    CustomPrefs: {
      ...base.CustomPrefs,
      [LAYOUT_KEY]: layoutToJson(defaults.layout),
      [VERSION_KEY]: defaults.version ?? '',
    },
  };
  await getDisplayPreferenceApi(api).updateDisplayPreferences({
    ...DOCUMENT,
    userId,
    displayPreferencesDto: dto,
  });
}

export interface Distribution {
  total: number;
  written: number;
  failed: number;
}

/**
 * Copies the default to every user (administrators only). With `onlyOutdated`, users whose copy
 * is already this version or newer are skipped, which is how users added later receive it.
 */
export async function distributeLayoutDefaults(
  api: Api,
  defaults: LayoutDefaults,
  options: { onlyOutdated: boolean; onProgress?: (progress: Distribution) => void },
): Promise<Distribution> {
  const { data: users } = await getUserApi(api).getUsers({});
  const ids = users.map((user) => user.Id).filter((id): id is string => Boolean(id));
  const progress: Distribution = { total: ids.length, written: 0, failed: 0 };
  const copyTo = async (userId: string) => {
    try {
      const stored = await fetchDocument(api, userId);
      const current =
        options.onlyOutdated &&
        stored.version !== null &&
        defaults.version !== null &&
        stored.version >= defaults.version;
      if (!current) await writeDocument(api, userId, stored.dto, defaults);
      progress.written += 1;
    } catch (error) {
      console.warn('The default arrangement could not be copied to a user', error);
      progress.failed += 1;
    }
    options.onProgress?.({ ...progress });
  };
  // A few at a time: households have a handful of users, larger servers should not be flooded.
  const queue = [...ids];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let userId = queue.shift(); userId !== undefined; userId = queue.shift()) {
      await copyTo(userId);
    }
  });
  await Promise.all(workers);
  return progress;
}
