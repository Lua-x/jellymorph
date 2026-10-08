import { Suspense, use, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, QueryResult } from '@/domain/types';
import { useFeatured, useResumeItems } from '@/hooks/useHome';
import { ThemeContext, type ThemeContextValue } from './context';
import type { ColorScheme, ThemeId } from './contract';
import { loadDefaultTheme, loadThemeModule } from './loader';
import { getThemeManifest } from './registry';
import { ThemeSlot } from './ThemeSlot';

/** The preview is laid out at this width and scaled to the space it gets. */
const VIRTUAL_WIDTH = 1280;

function PreviewContent({ themeId, colorScheme }: { themeId: ThemeId; colorScheme: ColorScheme }) {
  const { t } = useTranslation('content');
  const manifest = getThemeManifest(themeId);
  const module = use(loadThemeModule(manifest));
  const fallback = use(loadDefaultTheme());
  const value = useMemo<ThemeContextValue>(
    () => ({ manifest, module, fallback, colorScheme }),
    [manifest, module, fallback, colorScheme],
  );
  const options = { ...fallback.options, ...module.options };
  const hero = useFeatured(options.heroItemCount);
  const resume = useResumeItems();
  const row: QueryResult<MediaItem[]> =
    resume.status === 'success' && resume.data.length === 0 ? hero : resume;

  return (
    <ThemeContext value={value}>
      <ThemeSlot name="Hero" props={{ items: hero, context: 'preview' }} />
      <ThemeSlot
        name="Row"
        props={{
          title: t('home.sections.resume'),
          items: row,
          variant: 'landscape',
          seeAll: null,
          context: 'preview',
        }}
      />
    </ThemeContext>
  );
}

/**
 * Live preview of a theme with the user's own content (architecture §7.6): the theme's Hero and
 * Row in a container with its own data-theme, scaled down, inert and without focus stops.
 * Themes place it on their settings page.
 */
export function ThemePreview({
  themeId,
  colorScheme,
  className,
}: {
  themeId: ThemeId;
  colorScheme: ColorScheme;
  className?: string;
}) {
  const { t } = useTranslation(['settings', 'themes']);
  const frameRef = useRef<HTMLDivElement>(null);
  const manifest = getThemeManifest(themeId);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      frame.style.setProperty('--preview-scale', String(frame.clientWidth / VIRTUAL_WIDTH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className={['theme-preview-frame', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={t('theme.previewOf', { name: t(manifest.nameKey, { ns: 'themes' }) })}
    >
      <div
        className="theme-preview"
        data-theme={themeId}
        data-color-scheme={colorScheme}
        style={{ '--preview-width': `${String(VIRTUAL_WIDTH)}px` } as CSSProperties}
        inert
      >
        <Suspense fallback={null}>
          <PreviewContent themeId={themeId} colorScheme={colorScheme} />
        </Suspense>
      </div>
    </div>
  );
}
