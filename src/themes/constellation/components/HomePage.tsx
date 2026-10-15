import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeRow, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { ThemeSlot } from '../../ThemeSlot';
import type { HomePageProps } from '../../contract';
import { homeIsEmpty, splitHero } from '../../default/components/home';
import { EmptyState } from '../../default/components/States';
import styles from './HomePage.module.css';
import { Tiles } from './Tiles';

function sectionTitle(t: TFunction<'content'>, section: HomeRow): string {
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
 * The banner carousel, then the arranged areas. By default the large tiles for libraries and
 * collections come right under it: the collections join the library tiles whenever they follow
 * them directly, anywhere else they are a row of their own.
 */
export function HomePage(props: HomePageProps) {
  const { hero, libraries, sections } = props;
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const { heroShown, below } = splitHero(sections);
  const tilesAt = below.findIndex((section) => section.kind === 'libraries');
  const next = tilesAt >= 0 ? below[tilesAt + 1] : undefined;
  const joined = next?.kind === 'collections' ? next : null;

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{tCommon('nav.home')}</h1>
      {heroShown && <ThemeSlot name="Hero" props={{ items: hero, context: 'page' }} />}
      <div className={styles.rows}>
        {homeIsEmpty(props) && (
          <EmptyState title={t('home.empty.title')} message={t('home.empty.message')} />
        )}
        {below.map((section) => {
          if (section === joined) return null;
          switch (section.kind) {
            case 'hero':
              return null;
            case 'libraries':
              return (
                <Tiles
                  key={section.id}
                  libraries={libraries}
                  collections={joined ? joined.items : null}
                />
              );
            case 'genres':
              return <GenreList key={section.id} genres={section.genres} />;
            default:
              return (
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
              );
          }
        })}
      </div>
    </div>
  );
}
