import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeRow, Library, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import type { HomePageProps } from '../../contract';
import { homeIsEmpty, splitHero } from '../../default/components/home';
import { EmptyState, ErrorState } from '../../default/components/States';
import styles from './HomePage.module.css';

function sectionTitle(t: TFunction<'content'>, section: HomeRow): string {
  if (section.kind === 'latest')
    return t('home.sections.latest', { library: section.library?.name ?? '' });
  return t(`home.sections.${section.kind}`);
}

/** Libraries as a row of wide tiles with the name on the picture. */
function LibraryRow({ libraries }: { libraries: QueryResult<Library[]> }) {
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
                sizes="(min-width: 64rem) 20vw, 45vw"
                maxWidth={960}
                fallback={<span className={styles.libraryFallback} />}
              />
              {/* Jellyfin draws the name into the library pictures it generates; it is not laid over them again. */}
              <span className={library.image ? 'visually-hidden' : styles.libraryName}>
                {library.name}
              </span>
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
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

/** Hero, then rows of wide cards; by default libraries after the first two rows, genres last. */
export function HomePage(props: HomePageProps) {
  const { hero, libraries, sections } = props;
  const { t } = useTranslation('content');
  const { t: tCommon } = useTranslation();
  const { heroShown, below } = splitHero(sections);

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{tCommon('nav.home')}</h1>
      {heroShown && <ThemeSlot name="Hero" props={{ items: hero, context: 'page' }} />}
      <div className={heroShown ? styles.rows : `${styles.rows} ${styles.standalone}`}>
        {homeIsEmpty(props) && (
          <EmptyState title={t('home.empty.title')} message={t('home.empty.message')} />
        )}
        {below.map((section) => {
          switch (section.kind) {
            case 'hero':
              return null;
            case 'libraries':
              return <LibraryRow key={section.id} libraries={libraries} />;
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
