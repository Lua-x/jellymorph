import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeSection, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { ThemeSlot } from '../../ThemeSlot';
import type { HomePageProps } from '../../contract';
import { EmptyState } from '../../default/components/States';
import styles from './HomePage.module.css';
import { Tiles } from './Tiles';

function sectionTitle(t: TFunction<'content'>, section: HomeSection): string {
  if (section.kind === 'latest')
    return t('home.sections.latest', { library: section.library?.name ?? '' });
  return t(`home.sections.${section.kind}`);
}

function GenreList({ genres }: { genres: QueryResult<Genre[]> }) {
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

/**
 * The banner carousel, right under it the large tiles for libraries and collections, then the
 * rows of rounded cards; genres at the end.
 */
export function HomePage({ hero, libraries, sections }: HomePageProps) {
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const nothing =
    sections.length === 0 &&
    libraries.status === 'success' &&
    libraries.data.length === 0 &&
    hero.status !== 'pending';
  const collections = sections.find((section) => section.kind === 'collections');
  const rows = sections.filter(
    (section) => section.kind !== 'genres' && section.kind !== 'collections',
  );
  const genres = sections.find((section) => section.kind === 'genres');

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{tCommon('nav.home')}</h1>
      <ThemeSlot name="Hero" props={{ items: hero, context: 'page' }} />
      <div className={styles.rows}>
        {nothing && <EmptyState title={t('home.empty.title')} message={t('home.empty.message')} />}
        <Tiles
          libraries={libraries}
          collections={collections && collections.kind !== 'genres' ? collections.items : null}
        />
        {rows.map((section) =>
          section.kind === 'genres' ? null : (
            <ThemeSlot
              key={section.id}
              name="Row"
              props={{
                title: sectionTitle(t, section),
                items: section.items,
                variant: 'landscape',
                seeAll: section.seeAll,
                context: 'page',
              }}
            />
          ),
        )}
        {genres?.kind === 'genres' && <GenreList genres={genres.genres} />}
      </div>
    </div>
  );
}
