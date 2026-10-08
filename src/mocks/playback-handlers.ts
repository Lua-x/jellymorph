import { bypass, http, HttpResponse } from 'msw';
import { CLIP_TICKS, itemsById } from './catalog';
import type { Authed } from './handlers';
import {
  bitrateTestBytes,
  CLIP_URL,
  masterPlaylist,
  mediaPlaylist,
  playbackInfo,
  segmentsDto,
  subtitleVtt,
  trickplaySheetSvg,
  type PlaybackInfoBody,
} from './playback';
import type { MockState } from './state';
import { tokenOf } from './token';

const notFound = () => new HttpResponse(null, { status: 404 });
const noContent = () => new HttpResponse(null, { status: 204 });

interface ReportBody {
  ItemId?: string;
  PositionTicks?: number | null;
  PlaySessionId?: string | null;
}

let clipBytes: Promise<ArrayBuffer> | null = null;

/**
 * The clip as a partial response. The service worker drops the Range header when it forwards
 * a <video> request (no-cors), which would make the file unseekable, so the handler answers
 * range requests itself.
 */
async function clipResponse(request: Request): Promise<Response> {
  clipBytes ??= fetch(bypass(new URL(CLIP_URL, request.url))).then((response) =>
    response.arrayBuffer(),
  );
  const bytes = await clipBytes;
  const total = bytes.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('Range') ?? '');
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };
  if (!match) {
    return new HttpResponse(bytes, {
      headers: { ...headers, 'Content-Length': String(total) },
    });
  }
  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (start >= total || start > end) {
    return new HttpResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${String(total)}` },
    });
  }
  return new HttpResponse(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      ...headers,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${String(start)}-${String(end)}/${String(total)}`,
    },
  });
}

/** Jellyfin's resume rules: under 5 % starts over next time, over 90 % counts as watched. */
const MIN_RESUME = 0.05;
const MAX_RESUME = 0.9;

/** PlaybackInfo, streams, subtitles, segments, trickplay and playback reports. */
export function createPlaybackHandlers(state: MockState, authed: Authed) {
  const library = state.library;

  const report = async (
    kind: 'start' | 'progress' | 'stopped',
    userId: string,
    request: Request,
  ): Promise<Response> => {
    const body = ((await request.json().catch(() => null)) ?? {}) as ReportBody;
    state.reports.push({ kind, body });
    const item = itemsById.get(body.ItemId ?? '');
    if (!item) return noContent();
    const position = Math.max(0, body.PositionTicks ?? 0);
    const now = new Date().toISOString();
    if (kind === 'start' && body.PlaySessionId) {
      state.playSessions.set(body.PlaySessionId, { userId, itemId: item.id });
      library.set(userId, item.id, { lastPlayed: now });
    }
    if (kind === 'progress' && position > 0) {
      library.set(userId, item.id, { positionTicks: position, lastPlayed: now });
    }
    if (kind === 'stopped') {
      if (body.PlaySessionId) state.playSessions.delete(body.PlaySessionId);
      const share = position / CLIP_TICKS;
      if (share >= MAX_RESUME) {
        library.set(userId, item.id, { played: true, positionTicks: 0, lastPlayed: now });
      } else {
        library.set(userId, item.id, {
          positionTicks: share < MIN_RESUME ? 0 : position,
          lastPlayed: now,
        });
      }
    }
    return noContent();
  };

  return [
    http.post(
      '*/Items/:itemId/PlaybackInfo',
      authed(async (_user, request, params) => {
        if (state.hasFault('playbackInfo')) return new HttpResponse(null, { status: 500 });
        const item = itemsById.get(params.itemId ?? '');
        if (!item) return notFound();
        const body = ((await request.json().catch(() => null)) ?? {}) as PlaybackInfoBody;
        return HttpResponse.json(
          playbackInfo(item, body, tokenOf(request) ?? '', state.newPlaySessionId()),
        );
      }),
    ),

    // Direct play: the server would send the file; the demo sends the recorded clip.
    http.get(
      '*/Videos/:itemId/stream',
      authed((_user, request, params) => {
        if (!itemsById.has(params.itemId ?? '')) return notFound();
        if (state.hasFault('directPlay')) {
          // Bytes no browser can decode, to exercise the fallback to transcoding.
          return new HttpResponse('not a video', { headers: { 'Content-Type': 'video/mp4' } });
        }
        return clipResponse(request);
      }),
    ),

    http.get(
      '*/videos/:itemId/master.m3u8',
      authed((_user, request, params) => {
        if (!itemsById.has(params.itemId ?? '')) return notFound();
        if (state.hasFault('transcode')) return new HttpResponse(null, { status: 500 });
        return new HttpResponse(masterPlaylist(new URL(request.url).search.slice(1)), {
          headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
        });
      }),
    ),
    http.get(
      '*/videos/:itemId/main.m3u8',
      authed((_user, request) => {
        if (state.hasFault('transcode')) return new HttpResponse(null, { status: 500 });
        return new HttpResponse(mediaPlaylist(request.url), {
          headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
        });
      }),
    ),

    http.get(
      '*/Videos/:itemId/:sourceId/Subtitles/:index/Stream.vtt',
      authed((_user, _request, params) => subtitle(params.itemId, params.index)),
    ),
    http.get(
      '*/Videos/:itemId/:sourceId/Subtitles/:index/:ticks/Stream.vtt',
      authed((_user, _request, params) => subtitle(params.itemId, params.index)),
    ),

    http.get(
      '*/MediaSegments/:itemId',
      authed((_user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        if (!item) return notFound();
        const items = segmentsDto(item);
        return HttpResponse.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
      }),
    ),

    http.get(
      '*/Videos/:itemId/Trickplay/:width/:file',
      authed((_user, _request, params) => {
        const sheet = Number.parseInt(params.file ?? '', 10);
        const svg = Number.isFinite(sheet) ? trickplaySheetSvg(sheet) : null;
        if (!svg || !itemsById.has(params.itemId ?? '')) return notFound();
        return new HttpResponse(svg, {
          headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' },
        });
      }),
    ),

    http.get(
      '*/Playback/BitrateTest',
      authed((_user, request) => {
        const size = Number(new URL(request.url).searchParams.get('size') ?? 0);
        return new HttpResponse(bitrateTestBytes(size), {
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      }),
    ),

    http.post(
      '*/Sessions/Playing',
      authed((user, request) => report('start', user.id, request)),
    ),
    http.post(
      '*/Sessions/Playing/Progress',
      authed((user, request) => report('progress', user.id, request)),
    ),
    http.post(
      '*/Sessions/Playing/Stopped',
      authed((user, request) => report('stopped', user.id, request)),
    ),
    http.post(
      '*/Sessions/Playing/Ping',
      authed(() => {
        state.reports.push({ kind: 'ping', body: null });
        return noContent();
      }),
    ),
    http.delete(
      '*/Videos/ActiveEncodings',
      authed(() => noContent()),
    ),
  ];
}

function subtitle(itemId: string | undefined, index: string | undefined): Response {
  const item = itemsById.get(itemId ?? '');
  const vtt = item ? subtitleVtt(item, Number(index)) : null;
  if (!vtt) return notFound();
  return new HttpResponse(vtt, { headers: { 'Content-Type': 'text/vtt; charset=utf-8' } });
}
