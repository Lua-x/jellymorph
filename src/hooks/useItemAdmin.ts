import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { RemoteSearchResult } from '@jellyfin/sdk/lib/generated-client/models/remote-search-result';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  applyIdentity,
  deleteItem,
  deleteItemImage,
  deleteSubtitle,
  downloadRemoteImage,
  downloadSubtitle,
  fetchExternalIds,
  fetchItemImages,
  fetchMetadataEditor,
  fetchRemoteImages,
  saveMetadata,
  searchIdentity,
  searchSubtitles,
  uploadItemImage,
  uploadSubtitle,
} from '@/api/admin';
import { refreshItem } from '@/api/refresh';
import type {
  EditableImageType,
  ExternalIdField,
  IdentifyQuery,
  IdentifyResult,
  ItemImageEntry,
  MetadataDraft,
  MetadataEditorData,
  QueryResult,
  RefreshMode,
  RemoteImageList,
  RemoteSubtitle,
} from '@/domain/types';
import { paths } from '@/navigation/paths';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

/**
 * Administration of single items for the themes (phase 13). The calls need an administrator;
 * themes show their entry points only when `useIsAdmin()` (useAdminAccess.ts) says so. Only the
 * dialogs use these hooks, so their API clients load with the dialogs. After every change the
 * user's cached data is refreshed, so pages show the new state right away.
 */

function useAdminBase() {
  const { api, key } = useActiveSession();
  const client = useQueryClient();
  const adminKey = (...parts: string[]) => [...queryKeys.user(key), 'admin', ...parts] as const;
  const refreshAll = () =>
    client.invalidateQueries({ queryKey: queryKeys.user(key), refetchType: 'active' });
  return { api, client, key, adminKey, refreshAll };
}

/** The metadata editor: the item's current values, the server's age ratings and external IDs. */
export function useMetadataEditor(
  itemId: string,
  enabled: boolean,
): { editor: QueryResult<MetadataEditorData>; save: (draft: MetadataDraft) => Promise<void> } {
  const { api, adminKey, refreshAll } = useAdminBase();
  const query = useQuery({
    queryKey: adminKey('editor', itemId),
    queryFn: ({ signal }) => fetchMetadataEditor(api, itemId, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
  const result = toQueryResult(query);
  const editor: QueryResult<MetadataEditorData> =
    result.status === 'success' ? { ...result, data: result.data.editor } : result;
  return {
    editor,
    save: async (draft) => {
      const dto: BaseItemDto | undefined = query.data?.dto;
      if (!dto) throw new Error('The item is not loaded');
      await saveMetadata(api, dto, draft);
      await refreshAll();
    },
  };
}

/** Identify a movie or a series by title, year or an external ID, and apply a match. */
export function useIdentify(
  itemId: string,
  kind: 'movie' | 'series',
  enabled: boolean,
): {
  externalIds: QueryResult<ExternalIdField[]>;
  search: (query: IdentifyQuery) => Promise<IdentifyResult[]>;
  apply: (resultId: string, replaceImages: boolean) => Promise<void>;
} {
  const { api, adminKey, refreshAll } = useAdminBase();
  const found = useRef(new Map<string, RemoteSearchResult>());
  const externalIds = toQueryResult(
    useQuery({
      queryKey: adminKey('externalIds', itemId),
      queryFn: ({ signal }) => fetchExternalIds(api, itemId, signal),
      enabled,
      staleTime: 5 * 60_000,
    }),
  );
  return {
    externalIds,
    search: async (query) => {
      const results = await searchIdentity(api, kind, itemId, query);
      found.current.clear();
      return results.map((result, index) => {
        const id = String(index);
        found.current.set(id, result);
        return {
          id,
          name: result.Name ?? '',
          year: result.ProductionYear ?? null,
          overview: result.Overview ?? null,
          imageUrl: result.ImageUrl ?? null,
          provider: result.SearchProviderName ?? null,
        };
      });
    },
    apply: async (resultId, replaceImages) => {
      const result = found.current.get(resultId);
      if (!result) throw new Error('Unknown search result');
      await applyIdentity(api, itemId, result, replaceImages);
      await refreshAll();
    },
  };
}

/** The item's pictures and the alternatives the metadata providers offer. */
export function useItemImages(
  itemId: string,
  enabled: boolean,
): {
  images: QueryResult<ItemImageEntry[]>;
  download: (type: EditableImageType, url: string) => Promise<void>;
  upload: (type: EditableImageType, file: File) => Promise<void>;
  remove: (type: EditableImageType, index: number) => Promise<void>;
} {
  const { api, client, adminKey, refreshAll } = useAdminBase();
  const imagesKey = adminKey('images', itemId);
  const images = toQueryResult(
    useQuery({
      queryKey: imagesKey,
      queryFn: ({ signal }) => fetchItemImages(api, itemId, signal),
      enabled,
      staleTime: 0,
    }),
  );
  const changed = async () => {
    await client.invalidateQueries({ queryKey: imagesKey });
    await refreshAll();
  };
  return {
    images,
    download: async (type, url) => {
      await downloadRemoteImage(api, itemId, type, url);
      await changed();
    },
    upload: async (type, file) => {
      await uploadItemImage(api, itemId, type, file);
      await changed();
    },
    remove: async (type, index) => {
      await deleteItemImage(api, itemId, type, index);
      await changed();
    },
  };
}

export function useRemoteImages(
  itemId: string,
  type: EditableImageType,
  provider: string | null,
  enabled: boolean,
): QueryResult<RemoteImageList> {
  const { api, adminKey } = useAdminBase();
  return toQueryResult(
    useQuery({
      queryKey: adminKey('remoteImages', itemId, type, provider ?? ''),
      queryFn: ({ signal }) => fetchRemoteImages(api, itemId, type, provider, signal),
      enabled,
      staleTime: 5 * 60_000,
    }),
  );
}

/** Subtitles from the server's subtitle providers, plus upload and removal of files. */
export function useSubtitleAdmin(itemId: string): {
  search: (language: string) => Promise<RemoteSubtitle[]>;
  download: (subtitleId: string) => Promise<void>;
  upload: (
    file: File,
    options: { language: string; forced: boolean; hearingImpaired: boolean },
  ) => Promise<void>;
  remove: (index: number) => Promise<void>;
} {
  const { api, refreshAll } = useAdminBase();
  return {
    search: (language) => searchSubtitles(api, itemId, language),
    download: async (subtitleId) => {
      await downloadSubtitle(api, itemId, subtitleId);
      await refreshAll();
    },
    upload: async (file, options) => {
      await uploadSubtitle(api, itemId, file, options);
      await refreshAll();
    },
    remove: async (index) => {
      await deleteSubtitle(api, itemId, index);
      await refreshAll();
    },
  };
}

/**
 * Look up metadata again, or delete the item with its files. After deleting, the page goes back
 * (or home when it was opened directly); everything but the deleted item is then reloaded, so
 * the page does not flash "not found" on its way out.
 */
export function useItemMaintenance(itemId: string): {
  refresh: (options: { mode: RefreshMode; replaceImages: boolean }) => Promise<void>;
  remove: () => Promise<void>;
} {
  const { api, client, key, refreshAll } = useAdminBase();
  const navigate = useNavigate();
  return {
    refresh: async (options) => {
      await refreshItem(api, itemId, options);
      await refreshAll();
    },
    remove: async () => {
      await deleteItem(api, itemId);
      const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      void (index > 0 ? navigate(-1) : navigate(paths.home, { replace: true }));
      await client.invalidateQueries({
        queryKey: queryKeys.user(key),
        refetchType: 'active',
        predicate: (query) => !query.queryKey.includes(itemId),
      });
    },
  };
}
