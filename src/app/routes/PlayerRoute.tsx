import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useItemDetail, useSeriesStartEpisode } from '@/hooks/useItem';
import { isPlayable } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { usePlayer } from '@/player/usePlayer';
import { ThemeSlot } from '@/themes/ThemeSlot';
import { useActiveTheme } from '@/themes/context';

/**
 * The player is dark in every color scheme: the stage re-applies the active theme with its dark
 * tokens (the same scoping the theme live preview uses).
 */
function useDarkScope(): { 'data-theme': string; 'data-color-scheme': string } {
  const { manifest, colorScheme } = useActiveTheme();
  return {
    'data-theme': manifest.id,
    'data-color-scheme': manifest.colorSchemes.includes('dark') ? 'dark' : colorScheme,
  };
}

function parseStart(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Back to where the player was opened from, or to the item when it was opened directly. */
function useClosePlayer(itemId: string): () => void {
  const navigate = useNavigate();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(paths.item(itemId), { replace: true });
  };
}

/** Black full screen layer for the moments before the player itself appears. */
function PlayerBackdrop({ children }: { children: ReactNode }) {
  const scope = useDarkScope();
  return (
    <main id="main" className="player-stage" tabIndex={-1} {...scope}>
      {children}
    </main>
  );
}

/**
 * Without an explicit start position: resolve series to an episode and ask whether to resume a
 * started one. The answer becomes part of the URL, so a reload continues where it was.
 */
function PlayerStart({ itemId }: { itemId: string }) {
  const navigate = useNavigate();
  const close = useClosePlayer(itemId);
  const detail = useItemDetail(itemId);
  const isSeries = detail.status === 'success' && detail.data.kind === 'series';
  const seriesStart = useSeriesStartEpisode(itemId, isSeries);
  const scope = useDarkScope();
  useDocumentTitle(detail.status === 'success' ? detail.data.name : null);

  if (detail.status === 'error') {
    return (
      <PlayerBackdrop>
        <ThemeSlot name="ErrorState" props={{ error: detail.error, onRetry: detail.retry }} />
      </PlayerBackdrop>
    );
  }
  if (detail.status === 'pending' || (isSeries && seriesStart.status === 'pending')) {
    return (
      <PlayerBackdrop>
        <ThemeSlot name="LoadingState" props={{ variant: 'page' }} />
      </PlayerBackdrop>
    );
  }
  const item = detail.data;
  if (isSeries) {
    if (seriesStart.status === 'success' && seriesStart.data) {
      return <Navigate to={paths.play(seriesStart.data.id)} replace />;
    }
    return <Navigate to={paths.item(itemId)} replace />;
  }
  if (!isPlayable(item)) return <Navigate to={paths.item(itemId)} replace />;

  const position = item.userData.positionTicks / 10_000_000;
  if (position < 1 || item.userData.played) return <Navigate to={paths.play(itemId, 0)} replace />;
  return (
    <div {...scope}>
      <ThemeSlot
        name="ResumePrompt"
        props={{
          item,
          positionSeconds: position,
          onResume: () => {
            void navigate(paths.play(itemId, position), { replace: true });
          },
          onRestart: () => {
            void navigate(paths.play(itemId, 0), { replace: true });
          },
          onCancel: close,
        }}
      />
    </div>
  );
}

function PlayerScreen({ itemId, startSeconds }: { itemId: string; startSeconds: number }) {
  const navigate = useNavigate();
  const close = useClosePlayer(itemId);
  const { model, videoRef, stageRef, freezeRef } = usePlayer({
    itemId,
    startSeconds,
    onClose: close,
    onPlayNext: (next, start) => {
      void navigate(paths.play(next.id, start), { replace: true });
    },
  });
  useDocumentTitle(model.item?.name ?? null);
  const scope = useDarkScope();

  return (
    <main
      {...scope}
      id="main"
      ref={stageRef}
      className="player-stage"
      tabIndex={-1}
      data-controls={model.controlsVisible ? 'visible' : 'hidden'}
      onPointerMove={model.revealControls}
      onPointerDown={model.revealControls}
    >
      {/* Subtitles are added at runtime as <track> elements (player/subtitles.ts). */}
      {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
      <video ref={videoRef} className="player-video" playsInline preload="auto" />
      <canvas ref={freezeRef} className="player-freeze" hidden aria-hidden="true" />
      <ThemeSlot name="PlayerOverlay" props={{ player: model }} />
    </main>
  );
}

/**
 * /play/:itemId[?start=seconds]. The screen stays mounted when the next episode starts (only the
 * URL changes), so full screen mode is kept.
 */
export function PlayerRoute() {
  const { itemId = '' } = useParams();
  const [params] = useSearchParams();
  const start = parseStart(params.get('start'));
  if (start === null) return <PlayerStart key={itemId} itemId={itemId} />;
  return <PlayerScreen itemId={itemId} startSeconds={start} />;
}
