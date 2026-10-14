import type { Api } from '@jellyfin/sdk/lib/api';
import type { LibraryApiRefreshItemRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import type { RefreshMode } from '@/domain/types';

/*
 * Metadata refresh and library scan (phase 13). Kept apart from the other administration calls:
 * the library page offers the scan, and should not load the editors' API clients for it.
 */

/**
 * The three modes of jellyfin-web's refresh dialog: `scan` looks for new and changed files
 * (Default), `missing` asks the providers and fills only empty fields, `all` replaces everything
 * (both FullRefresh). Pictures can only be replaced with a full refresh.
 */
export function refreshRequest(
  itemId: string,
  options: { mode: RefreshMode; replaceImages: boolean },
): LibraryApiRefreshItemRequest {
  const mode = options.mode === 'scan' ? 'Default' : 'FullRefresh';
  return {
    itemId,
    metadataRefreshMode: mode,
    imageRefreshMode: mode,
    replaceAllMetadata: options.mode === 'all',
    replaceAllImages: mode === 'FullRefresh' && options.replaceImages,
  };
}

export async function refreshItem(
  api: Api,
  itemId: string,
  options: { mode: RefreshMode; replaceImages: boolean },
) {
  await getLibraryApi(api).refreshItem(refreshRequest(itemId, options));
}

/** Scans one library for new and removed files (a scan of its folder, as jellyfin-web does). */
export async function scanLibrary(api: Api, libraryId: string) {
  await refreshItem(api, libraryId, { mode: 'scan', replaceImages: false });
}
