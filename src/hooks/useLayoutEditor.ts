import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { distributeLayoutDefaults } from '@/api/layout-defaults';
import {
  arrange,
  canHide,
  isPinned,
  LAYOUT_LISTS,
  moveEntry,
  setEntryHidden,
  type Layout,
  type LayoutDefaults,
  type LayoutListId,
} from '@/domain/layout';
import type {
  LayoutDistribution,
  LayoutEditorList,
  LayoutEditorModel,
  LayoutScope,
} from '@/settings/model';
import { useUserSettings } from '@/settings/user-settings';
import { useIsAdmin } from './useAdminAccess';
import { homeAreaIds, latestLibrariesOf } from './useHome';
import { layoutDefaultsKey, useLayoutDefaults, useOwnLayout } from './useLayout';
import { useNavEntries } from './useNavModel';
import { useActiveSession } from './useSession';
import { useCurrentUser, useLibraries } from './useUser';

const IDLE: LayoutDistribution = { state: 'idle', written: 0, failed: 0, total: 0 };

function withList(layout: Layout, list: LayoutListId, value: Layout[LayoutListId] | null): Layout {
  const next: Layout = {};
  for (const id of LAYOUT_LISTS) {
    const kept = id === list ? value : layout[id];
    if (kept) next[id] = kept;
  }
  return next;
}

/**
 * The settings' arrangement editor (phase 14). The own scope changes the user's settings at once
 * (synced like every setting); the default for everybody is a draft that an administrator saves
 * for all users in one go.
 */
export function useLayoutEditor(themeDefaults: LayoutDefaults): LayoutEditorModel {
  const { t } = useTranslation(['settings', 'content']);
  const { api, key } = useActiveSession();
  const client = useQueryClient();
  const isAdmin = useIsAdmin();
  const own = useOwnLayout();
  const defaults = useLayoutDefaults();
  const libraries = useLibraries();
  const user = useCurrentUser();
  const navEntries = useNavEntries();
  const [scope, setScope] = useState<LayoutScope>('own');
  const [draft, setDraft] = useState<Layout | null>(null);
  const [distribution, setDistribution] = useState<LayoutDistribution>(IDLE);

  const everybody = defaults.status === 'success' ? defaults.data.layout : {};
  const editing: Layout = scope === 'own' ? own : (draft ?? everybody);

  const latestLibraries = latestLibrariesOf(
    libraries.status === 'success' ? libraries.data : [],
    user.status === 'success' ? user.data.latestExcludes : [],
  );
  const libraryNames = new Map(latestLibraries.map((library) => [library.id, library.name]));
  const navLabels = new Map(navEntries.map((entry) => [entry.id, entry.label]));

  const label = (list: LayoutListId, id: string): string => {
    switch (list) {
      case 'home':
        if (id.startsWith('latest-'))
          return t('home.sections.latest', {
            ns: 'content',
            library: libraryNames.get(id.slice('latest-'.length)) ?? '',
          });
        if (id === 'hero' || id === 'libraries') return t(`layout.entries.${id}`);
        return t(`home.sections.${id as 'resume'}`, { ns: 'content' });
      case 'nav':
        return navLabels.get(id) ?? id;
      case 'detailActions':
        return t(`layout.actions.${id as 'play'}`);
      case 'facts':
        return t(`layout.facts.${id as 'year'}`);
    }
  };

  const available: Record<LayoutListId, readonly string[]> = {
    home: homeAreaIds(themeDefaults.home, latestLibraries),
    nav: navEntries.map((entry) => entry.id),
    // "Edit" is for administrators only; everybody else never sees it anyway.
    detailActions: themeDefaults.detailActions.filter((id) => id !== 'edit' || isAdmin),
    facts: themeDefaults.facts,
  };

  const change = (list: LayoutListId, value: Layout[LayoutListId] | null) => {
    if (scope === 'own') {
      useUserSettings.getState().update({ layout: withList(own, list, value) });
    } else {
      setDraft(withList(draft ?? everybody, list, value));
      setDistribution(IDLE);
    }
  };

  const lists: LayoutEditorList[] = LAYOUT_LISTS.map((list) => {
    // What applies in this scope: the own list falls back to the default for everybody.
    const current = scope === 'own' ? (own[list] ?? everybody[list]) : editing[list];
    const entries = arrange(available[list], current);
    return {
      id: list,
      entries: entries.map((entry) => ({
        ...entry,
        label: label(list, entry.id),
        pinned: isPinned(entry.id),
        required: !canHide(entry.id),
      })),
      customized: editing[list] !== undefined,
      move: (from, to) => {
        change(list, moveEntry(entries, from, to));
      },
      setHidden: (id, hidden) => {
        change(list, setEntryHidden(current, id, hidden));
      },
      reset: () => {
        change(list, null);
      },
    };
  });

  return {
    scope,
    canEditDefault: isAdmin,
    setScope: (next) => {
      setScope(next === 'everybody' && !isAdmin ? 'own' : next);
    },
    lists,
    draftChanged: draft !== null,
    saveDefault: () => {
      if (!draft) return;
      const saved = { layout: draft, version: new Date().toISOString() };
      setDistribution({ ...IDLE, state: 'saving' });
      distributeLayoutDefaults(api, saved, {
        onlyOutdated: false,
        onProgress: (progress) => {
          setDistribution({ state: 'saving', ...progress });
        },
      }).then(
        (result) => {
          setDistribution({ state: result.failed > 0 ? 'error' : 'saved', ...result });
          setDraft(null);
          void client.invalidateQueries({ queryKey: layoutDefaultsKey(key) });
        },
        (error: unknown) => {
          console.warn('The default arrangement could not be saved', error);
          setDistribution({ ...IDLE, state: 'error' });
        },
      );
    },
    discardDefault: () => {
      setDraft(null);
      setDistribution(IDLE);
    },
    distribution,
  };
}
