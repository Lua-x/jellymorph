import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { CastMember, ItemDetail, MediaItem, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import styles from './DetailSections.module.css';

/** Cast and crew as round portraits in a row; each one leads to the person's titles. */
export function CastShelf({ cast }: { cast: CastMember[] }) {
  const { t } = useTranslation('theme-glass');
  const headingId = useId();
  if (cast.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {t('detail.castAndCrew')}
      </h2>
      <ul className={styles.cast}>
        {cast.slice(0, 16).map((person) => (
          <li key={`${person.id}-${person.role ?? person.kind}`}>
            <AppLink to={paths.person(person.id)} className={styles.person}>
              <span className={styles.portrait}>
                <JellyImage
                  image={person.image}
                  sizes="7rem"
                  maxWidth={300}
                  fallback={
                    <span className={styles.portraitFallback}>
                      <Icon name="user" />
                    </span>
                  }
                />
              </span>
              <span className={styles.personName}>{person.name}</span>
              {person.role && <span className={styles.personRole}>{person.role}</span>}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "More like this" as a shelf of posters; hidden when the server knows none. */
export function SimilarShelf({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('content');
  if (items.status === 'success' && items.data.length === 0) return null;
  return (
    <ThemeSlot
      name="Row"
      props={{
        title: t('detail.similar'),
        items,
        variant: 'poster',
        seeAll: null,
        context: 'page',
      }}
    />
  );
}

/** The facts in a panel of frosted glass: two columns of label and value. */
export function InfoPanel({ item }: { item: ItemDetail }) {
  const { t, i18n } = useTranslation('content');
  const { t: tGlass } = useTranslation('theme-glass');
  const headingId = useId();
  const directors = item.cast.filter((member) => member.kind === 'director');
  const released = item.premiereDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
        new Date(item.premiereDate),
      )
    : item.year !== null
      ? String(item.year)
      : null;
  const rows: [string, string | null][] = [
    [tGlass('detail.genres'), item.genres.join(', ') || null],
    [tGlass('detail.released'), released],
    [tGlass('detail.runtime'), item.kind === 'series' ? null : runtimeText(t, item.runtimeMinutes)],
    [tGlass('detail.rated'), item.officialRating],
    [
      t('detail.director', { count: directors.length }),
      directors.map((person) => person.name).join(', ') || null,
    ],
    [t('detail.studios'), item.studios.join(', ') || null],
    [t('detail.audio'), item.audioTracks.map((track) => track.title).join(', ') || null],
    [t('detail.subtitles'), item.subtitleTracks.map((track) => track.title).join(', ') || null],
  ];
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (shown.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {tGlass('detail.information')}
      </h2>
      <dl className={styles.info}>
        {shown.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
