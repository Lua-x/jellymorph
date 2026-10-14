import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { describe, expect, it } from 'vitest';
import { dashboardUrl } from '@/hooks/useNavModel';
import { applyMetadataDraft, toMetadataDraft } from './admin';
import { refreshRequest } from './refresh';

const dto: BaseItemDto = {
  Id: 'abc',
  Name: 'Kupferherz',
  OriginalTitle: 'Copper Heart',
  ForcedSortName: null,
  Overview: 'Line one<br>line two',
  Taglines: ['Ein Herz aus Metall'],
  Genres: ['Drama'],
  Tags: ['4K'],
  Studios: [{ Name: 'Nordlicht', Id: 's1' }],
  ProductionYear: 2021,
  PremiereDate: '2021-03-04T00:00:00.0000000Z',
  EndDate: null,
  OfficialRating: 'FSK-12',
  CommunityRating: 7.4,
  CriticRating: 81,
  ProviderIds: { Tmdb: '123', Imdb: '' },
  LockData: false,
  RunTimeTicks: 72_000_000_000,
  UserData: { Key: 'abc', ItemId: 'abc', IsFavorite: true },
};

describe('toMetadataDraft', () => {
  it('reads the editable fields and drops empty provider IDs', () => {
    expect(toMetadataDraft(dto)).toEqual({
      name: 'Kupferherz',
      originalTitle: 'Copper Heart',
      sortName: '',
      overview: 'Line one<br>line two',
      tagline: 'Ein Herz aus Metall',
      genres: ['Drama'],
      tags: ['4K'],
      studios: ['Nordlicht'],
      year: 2021,
      premiereDate: '2021-03-04',
      endDate: null,
      officialRating: 'FSK-12',
      communityRating: 7.4,
      criticRating: 81,
      providerIds: { Tmdb: '123' },
      locked: false,
    });
  });

  it('copes with a sparse item', () => {
    const draft = toMetadataDraft({ Id: 'x' });
    expect(draft.name).toBe('');
    expect(draft.genres).toEqual([]);
    expect(draft.premiereDate).toBeNull();
    expect(draft.locked).toBe(false);
  });
});

describe('applyMetadataDraft', () => {
  it('sends the whole item back with only the edited fields replaced', () => {
    const draft = { ...toMetadataDraft(dto), name: '  Kupferherz (Director’s Cut) ', year: 2022 };
    const result = applyMetadataDraft(dto, draft);
    expect(result.Name).toBe('Kupferherz (Director’s Cut)');
    expect(result.ProductionYear).toBe(2022);
    // Untouched fields are still there, so Jellyfin does not clear them.
    expect(result.Overview).toBe(dto.Overview);
    expect(result.OfficialRating).toBe('FSK-12');
    expect(result.CommunityRating).toBe(7.4);
    expect(result.RunTimeTicks).toBe(dto.RunTimeTicks);
    expect(result.UserData).toEqual(dto.UserData);
    expect(result.Studios).toEqual([{ Name: 'Nordlicht' }]);
  });

  it('turns emptied text into null and dates into server timestamps', () => {
    const draft = {
      ...toMetadataDraft(dto),
      originalTitle: '   ',
      tagline: '',
      officialRating: '',
      premiereDate: '2020-01-31',
      locked: true,
    };
    const result = applyMetadataDraft(dto, draft);
    expect(result.OriginalTitle).toBeNull();
    expect(result.Taglines).toEqual([]);
    expect(result.OfficialRating).toBeNull();
    expect(result.PremiereDate).toBe('2020-01-31T00:00:00.0000000Z');
    expect(result.LockData).toBe(true);
  });
});

describe('refreshRequest', () => {
  it.each([
    ['scan', false, 'Default', false, false],
    ['scan', true, 'Default', false, false],
    ['missing', false, 'FullRefresh', false, false],
    ['missing', true, 'FullRefresh', false, true],
    ['all', false, 'FullRefresh', true, false],
    ['all', true, 'FullRefresh', true, true],
  ] as const)(
    'maps %s (pictures %s) like jellyfin-web',
    (mode, replaceImages, refreshMode, replaceAllMetadata, replaceAllImages) => {
      expect(refreshRequest('id', { mode, replaceImages })).toEqual({
        itemId: 'id',
        metadataRefreshMode: refreshMode,
        imageRefreshMode: refreshMode,
        replaceAllMetadata,
        replaceAllImages,
      });
    },
  );
});

describe('dashboardUrl', () => {
  it('points at jellyfin-web on the server, also through the proxy', () => {
    expect(dashboardUrl('https://jf.example.com/')).toBe('https://jf.example.com/web/#/dashboard');
    expect(dashboardUrl('http://localhost:8080/jellyfin')).toBe(
      'http://localhost:8080/jellyfin/web/#/dashboard',
    );
  });
});
