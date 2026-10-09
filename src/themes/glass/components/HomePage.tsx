import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeSection, Library, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import type { CardVariant, HomePageProps } from '../../contract';
import { EmptyState, ErrorState } from '../../default/components/States';
import styles from './HomePage.module.css';

function sectionTitle(t: TFunction<'content'>, section: HomeSection): string {
  if (section.kind === 'latest')
    return t('home.sections.latest', { library: section.library?.name ?? '' });
  return t(`home.sections.${section.kind}`);
}

/** Started and upcoming episodes read best as wide stills; everything else as posters. */
function variantOf(section: HomeSection): CardVariant {
  if (section.kind === 'resume' || section.kind === 'nextUp') return 'landscape';
  return 'poster';
}

/** Libraries as large rounded tiles with the name on frosted glass. */
function LibraryTiles({ libraries }: { libraries: QueryResult<Library[]> }) {
  const { t } = useTranslation('content');
  const headingId = useId();
  if (libraries.status === 'error') {
    return <ErrorState variant="section" error={libraries.error} onRetry={libraries.retry} />;
  }
  if (libraries.status !== 'success' || libraries.data.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('home.libraries')}
      </h2>
      <ul className={styles.libraries}>
        {libraries.data.map((library) => (
          <li key={library.id}>
            <AppLink to={paths.library(library.id)} className={styles.library}>
              <JellyImage
                image={library.image}
                sizes="(min-width: 64rem) 22vw, 45vw"
                maxWidth={960}
                fallback={<span className={styles.libraryFallback} />}
              />
              <span className={styles.libraryName}>{library.name}</span>
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GenreChips({ genres }: { genres: QueryResult<Genre[]> }) {
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
              {genre.name}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Full-screen hero, then calm shelves; libraries after the first shelf, genres at the end. */
export function HomePage({ hero, libraries, sections }: HomePageProps) {
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const nothing =
    sections.length === 0 &&
    libraries.status === 'success' &&
    libraries.data.length === 0 &&
    hero.status !== 'pending';
  const rows = sections.filter((section) => section.kind !== 'genres');
  const genres = sections.find((section) => section.kind === 'genres');
  const renderRow = (section: (typeof rows)[number]) => (
    <ThemeSlot
      key={section.id}
      name="Row"
      props={{
        title: sectionTitle(t, section),
        items: section.items,
        variant: variantOf(section),
        seeAll: section.seeAll,
        context: 'page',
      }}
    />
  );

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{tCommon('nav.home')}</h1>
      <ThemeSlot name="Hero" props={{ items: hero, context: 'page' }} />
      <div className={styles.rows}>
        {nothing && <EmptyState title={t('home.empty.title')} message={t('home.empty.message')} />}
        {rows.slice(0, 1).map(renderRow)}
        <LibraryTiles libraries={libraries} />
        {rows.slice(1).map(renderRow)}
        {genres?.kind === 'genres' && <GenreChips genres={genres.genres} />}
      </div>
    </div>
  );
}
