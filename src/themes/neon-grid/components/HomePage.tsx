import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeSection, Library, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import type { CardVariant, HomePageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import styles from './HomePage.module.css';
import { EmptyState, ErrorState } from './States';

const KIND_ICONS = {
  movies: 'movies',
  shows: 'shows',
  collections: 'collections',
  videos: 'videos',
  mixed: 'folder',
} as const;

function sectionTitle(t: TFunction<'content'>, section: HomeSection): string {
  if (section.kind === 'latest')
    return t('home.sections.latest', { library: section.library?.name ?? '' });
  return t(`home.sections.${section.kind}`);
}

function sectionVariant(kind: HomeSection['kind']): CardVariant {
  return kind === 'resume' || kind === 'nextUp' ? 'landscape' : 'poster';
}

/** Libraries as numbered "sectors" with a glowing frame. */
function Sectors({ libraries }: { libraries: QueryResult<Library[]> }) {
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const headingId = useId();
  if (libraries.status === 'error') {
    return <ErrorState variant="section" error={libraries.error} onRetry={libraries.retry} />;
  }
  const list = libraries.status === 'success' ? libraries.data : [];
  if (libraries.status === 'success' && list.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        <span className="visually-hidden">{t('home.libraries')}</span>
        <span aria-hidden="true">{tNeon('home.sectors')}</span>
      </h2>
      <ul className={styles.sectors}>
        {libraries.status === 'pending'
          ? Array.from({ length: 4 }, (_, index) => (
              <li
                key={index}
                className={`${styles.sector} ${styles.sectorSkeleton}`}
                aria-hidden="true"
              />
            ))
          : list.map((library, index) => (
              <li key={library.id}>
                <AppLink to={paths.library(library.id)} className={styles.sector}>
                  <span className={styles.sectorImage}>
                    <JellyImage
                      image={library.image}
                      sizes="(min-width: 64rem) 20vw, 45vw"
                      maxWidth={960}
                      fallback={<span className={styles.sectorFallback} />}
                    />
                    <span className={styles.scanlines} aria-hidden="true" />
                  </span>
                  <span className={styles.sectorNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.sectorLabel}>
                    <Icon name={KIND_ICONS[library.kind]} />
                    <span>{library.name}</span>
                    {tCommon(`home.kinds.${library.kind}`) !== library.name && (
                      <span className="visually-hidden">
                        {tCommon(`home.kinds.${library.kind}`)}
                      </span>
                    )}
                  </span>
                </AppLink>
              </li>
            ))}
      </ul>
    </section>
  );
}

function GenreTags({ genres }: { genres: QueryResult<Genre[]> }) {
  const { t } = useTranslation('content');
  const headingId = useId();
  if (genres.status !== 'success') return null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('home.sections.genres')}
      </h2>
      <ul className={styles.genres}>
        {genres.data.map((genre) => (
          <li key={genre.id}>
            <AppLink to={paths.genre(genre.id)} className={styles.genre}>
              <span aria-hidden="true">#</span>
              {genre.name}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomePage({ hero, libraries, sections }: HomePageProps) {
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const nothing =
    sections.length === 0 &&
    libraries.status === 'success' &&
    libraries.data.length === 0 &&
    hero.status !== 'pending';

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{tCommon('nav.home')}</h1>
      <ThemeSlot name="Hero" props={{ items: hero, context: 'page' }} />
      <div className={styles.rows}>
        <Sectors libraries={libraries} />
        {nothing && <EmptyState title={t('home.empty.title')} message={t('home.empty.message')} />}
        {sections.map((section) =>
          section.kind === 'genres' ? (
            <GenreTags key={section.id} genres={section.genres} />
          ) : (
            <ThemeSlot
              key={section.id}
              name="Row"
              props={{
                title: sectionTitle(t, section),
                items: section.items,
                variant: sectionVariant(section.kind),
                seeAll: section.seeAll,
                context: 'page',
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
