import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { describe, expect, it } from 'vitest';
import { toItemDetail, toMediaItem, toSeason, type ImageUrlFactory } from './map';

const urls: ImageUrlFactory = (id, type, tag, index) =>
  `img/${id}/${type}${index === undefined ? '' : `/${index}`}?tag=${tag}`;

const episode: BaseItemDto = {
  Id: 'ep1',
  Name: 'Die Rückkehr',
  Type: 'Episode',
  SeriesId: 'series1',
  SeriesName: 'Nordlicht',
  SeasonId: 'season1',
  ParentIndexNumber: 2,
  IndexNumber: 5,
  RunTimeTicks: 27_000_000_000,
  PremiereDate: '2021-03-04T00:00:00.0000000Z',
  ImageTags: { Primary: 'p1' },
  ParentBackdropItemId: 'series1',
  ParentBackdropImageTags: ['b1'],
  ParentLogoItemId: 'series1',
  ParentLogoImageTag: 'l1',
  ImageBlurHashes: { Primary: { p1: 'LEHV6nWB2yk8' }, Backdrop: { b1: 'L6PZfSi_.AyE' } },
  UserData: { Key: 'k', Played: false, PlaybackPositionTicks: 600_000_000, PlayedPercentage: 22.2 },
};

describe('toMediaItem', () => {
  it('maps an episode with parent images and progress', () => {
    const item = toMediaItem(episode, urls);
    expect(item).toMatchObject({
      id: 'ep1',
      kind: 'episode',
      year: 2021,
      runtimeMinutes: 45,
      episode: { seriesId: 'series1', seriesName: 'Nordlicht', seasonNumber: 2, episodeNumber: 5 },
      userData: { played: false, favorite: false, progress: 0.222 },
    });
    expect(item.images.primary).toEqual({
      url: 'img/ep1/Primary?tag=p1',
      blurHash: 'LEHV6nWB2yk8',
      aspectRatio: 16 / 9,
    });
    expect(item.images.backdrop?.url).toBe('img/series1/Backdrop/0?tag=b1');
    expect(item.images.backdrop?.blurHash).toBe('L6PZfSi_.AyE');
    expect(item.images.logo?.url).toBe('img/series1/Logo?tag=l1');
  });

  it('reports no progress for finished or unstarted items', () => {
    const played = toMediaItem(
      {
        ...episode,
        UserData: { Key: 'k', Played: true, PlaybackPositionTicks: 5, PlayedPercentage: 90 },
      },
      urls,
    );
    expect(played.userData.progress).toBeNull();
    const fresh = toMediaItem({ ...episode, UserData: { Key: 'k' } }, urls);
    expect(fresh.userData.progress).toBeNull();
  });

  it('handles sparse DTOs without throwing', () => {
    const item = toMediaItem({ Id: 'x', Type: 'SomethingNew' as BaseItemDto['Type'] }, urls);
    expect(item).toMatchObject({ id: 'x', kind: 'other', name: '', year: null, genres: [] });
    expect(item.images).toEqual({ primary: null, backdrop: null, thumb: null, logo: null });
  });

  it('only reports an end year for ended series', () => {
    const series: BaseItemDto = {
      Id: 's',
      Type: 'Series',
      ProductionYear: 2015,
      EndDate: '2019-06-01',
    };
    expect(toMediaItem({ ...series, Status: 'Ended' }, urls).endYear).toBe(2019);
    expect(toMediaItem({ ...series, Status: 'Continuing' }, urls).endYear).toBeNull();
  });
});

describe('toItemDetail', () => {
  it('collects cast, tracks and a video label', () => {
    const detail = toItemDetail(
      {
        Id: 'm1',
        Type: 'Movie',
        BackdropImageTags: ['b0', 'b1'],
        People: [
          { Id: 'p1', Name: 'Ana Weiß', Role: 'Kapitänin', Type: 'Actor', PrimaryImageTag: 't1' },
          { Id: 'p2', Name: 'Jo Berg', Type: 'Director' },
          { Name: 'Ohne Id', Type: 'Actor' },
        ],
        MediaStreams: [
          { Type: 'Video', Width: 3840, VideoRangeType: 'HDR10', Index: 0 },
          {
            Type: 'Audio',
            Index: 1,
            DisplayTitle: 'Deutsch - AC3 5.1',
            Language: 'ger',
            IsDefault: true,
          },
          {
            Type: 'Subtitle',
            Index: 2,
            DisplayTitle: 'English - SRT',
            Language: 'eng',
            IsForced: true,
          },
        ],
        Status: 'Continuing',
        LocalTrailerCount: 1,
      },
      urls,
    );
    expect(detail.backdrops.map((image) => image.url)).toEqual([
      'img/m1/Backdrop/0?tag=b0',
      'img/m1/Backdrop/1?tag=b1',
    ]);
    expect(detail.cast).toEqual([
      expect.objectContaining({ id: 'p1', role: 'Kapitänin', kind: 'actor' }),
      expect.objectContaining({ id: 'p2', kind: 'director', image: null }),
    ]);
    expect(detail.audioTracks).toEqual([
      expect.objectContaining({ index: 1, title: 'Deutsch - AC3 5.1', isDefault: true }),
    ]);
    expect(detail.subtitleTracks[0]).toMatchObject({ index: 2, isForced: true });
    expect(detail.videoLabel).toBe('4K · HDR');
    expect(detail.seriesStatus).toBe('continuing');
    expect(detail.localTrailerCount).toBe(1);
  });
});

describe('toSeason', () => {
  it('maps numbers and unwatched counts', () => {
    expect(
      toSeason(
        {
          Id: 's1',
          Name: 'Staffel 1',
          IndexNumber: 1,
          ChildCount: 8,
          UserData: { Key: 'k', UnplayedItemCount: 3 },
        },
        urls,
      ),
    ).toEqual({
      id: 's1',
      name: 'Staffel 1',
      number: 1,
      image: null,
      episodeCount: 8,
      unplayedCount: 3,
      played: false,
    });
  });
});
