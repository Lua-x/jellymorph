import type { TFunction } from 'i18next';
import { useId, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Genre, HomeRow, Library, MediaItem, QueryResult } from '@/domain/types';
import { linkTo, paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import type { HomePageProps } from '../../contract';
import { homeIsEmpty, splitHero } from '../../default/components/home';
import { cardTitle, yearText } from '../../default/components/meta';
import { EmptyState, ErrorState } from '../../default/components/States';
import styles from './HomePage.module.css';

function sectionTitle(t: TFunction<'content'>, section: HomeRow): string {
  if (section.kind === 'latest')
    return t('home.sections.latest', { library: section.library?.name ?? '' });
  return t(`home.sections.${section.kind}`);
}

/** ←/→ move between the entries of a row; the list itself never takes focus. */
function onTrackKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const slot = (event.target as HTMLElement).closest('li');
  const sibling =
    event.key === 'ArrowRight' ? slot?.nextElementSibling : slot?.previousElementSibling;
  const target = sibling?.querySelector<HTMLElement>('a, button');
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * The ten best rated titles as a ranked row: a large outlined number beside each poster. The
 * numbers are decoration; the ordered list tells screen readers the place.
 */
function RankedRow({ title, items }: { title: string; items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('content');
  const headingId = useId();
  if (items.status === 'error') {
    return <ErrorState variant="section" error={items.error} onRetry={items.retry} />;
  }
  const list = items.status === 'success' ? items.data : [];
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      <div className={styles.rankedViewport}>
        {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- keyboard delegation */}
        <ol className={styles.ranked} onKeyDown={onTrackKeyDown}>
          {items.status === 'pending'
            ? Array.from({ length: 6 }, (_, index) => (
                <li key={index} className={styles.rank} aria-hidden="true">
                  <span className={styles.number}>{index + 1}</span>
                  <span className={`${styles.poster} ${styles.posterSkeleton}`} />
                </li>
              ))
            : list.map((item, index) => (
                <li key={item.id} className={styles.rank}>
                  <span className={styles.number} aria-hidden="true">
                    {index + 1}
                  </span>
                  <AppLink to={linkTo(item)} className={styles.rankLink}>
                    <span className={styles.poster}>
                      <JellyImage
                        image={item.images.primary ?? item.images.thumb}
                        sizes="(min-width: 64rem) 11vw, 30vw"
                        maxWidth={480}
                      />
                    </span>
                    <span className="visually-hidden">
                      {cardTitle(item)}
                      {yearText(t, item) && `, ${yearText(t, item) ?? ''}`}
                    </span>
                  </AppLink>
                </li>
              ))}
        </ol>
      </div>
    </section>
  );
}

/** Libraries as wide cards with their picture (Jellyfin draws the name into it). */
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
                sizes="(min-width: 64rem) 18vw, 45vw"
                maxWidth={640}
                fallback={<span className={styles.libraryFallback} />}
              />
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

/**
 * The spotlight, then rows of landscape cards with the ranked row of the best rated titles and
 * the upcoming episodes among them. Areas follow the arrangement (phase 14).
 */
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
            case 'topRated':
              return (
                <RankedRow
                  key={section.id}
                  title={sectionTitle(t, section)}
                  items={section.items}
                />
              );
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
