import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, MediaItem, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { useThemeComponent } from '../../context';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Sections of a details page as text tabs with a bar underneath (WAI-ARIA tabs: arrow keys,
 * Home and End move and select, only the chosen tab is in the Tab order).
 */
export function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const { t } = useTranslation('theme-horizon');
  const [selectedId, setSelectedId] = useState(tabs[0]?.id ?? '');
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const selected = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === selected?.id);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    const tab = next === null ? undefined : tabs[next];
    if (!tab) return;
    event.preventDefault();
    setSelectedId(tab.id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${tab.id}"]`)?.focus();
  };

  if (!selected) return null;
  return (
    <div className={styles.tabsArea}>
      <div ref={listRef} className={styles.tabs} role="tablist" aria-label={t('detail.sections')}>
        {tabs.map((tab) => {
          const active = tab.id === selected.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              data-tab={tab.id}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              className={styles.tab}
              onKeyDown={onKeyDown}
              onClick={() => {
                setSelectedId(tab.id);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${baseId}-panel-${selected.id}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${selected.id}`}
        className={styles.panel}
      >
        {selected.content}
      </div>
    </div>
  );
}

/** "More like this" as a grid of the unfolding cards. */
export function RelatedPanel({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('theme-horizon');
  const MediaCard = useThemeComponent('MediaCard');
  if (items.status === 'pending') return <LoadingState variant="section" />;
  if (items.status === 'error') {
    return <ErrorState variant="section" error={items.error} onRetry={items.retry} />;
  }
  if (items.data.length === 0) return <EmptyState title={t('detail.noRelated')} />;
  return (
    <ul className={styles.grid}>
      {items.data.slice(0, 18).map((item) => (
        <li key={item.id}>
          <MediaCard item={item} variant="landscape" context="page" />
        </li>
      ))}
    </ul>
  );
}

/** Facts in two columns, then the cast with links to their titles. */
export function DetailsPanel({ item }: { item: ItemDetail }) {
  const { t, i18n } = useTranslation('content');
  const { t: tHorizon } = useTranslation('theme-horizon');
  const directors = item.cast.filter((member) => member.kind === 'director');
  const actors = item.cast.filter((member) => member.kind === 'actor');
  const released = item.premiereDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
        new Date(item.premiereDate),
      )
    : item.year !== null
      ? String(item.year)
      : null;
  const rows: [string, string | null][] = [
    [tHorizon('detail.genres'), item.genres.join(', ') || null],
    [tHorizon('detail.released'), released],
    [
      tHorizon('detail.runtime'),
      item.kind === 'series' ? null : runtimeText(t, item.runtimeMinutes),
    ],
    [tHorizon('detail.rated'), item.officialRating],
    [
      t('detail.director', { count: directors.length }),
      directors.map((person) => person.name).join(', ') || null,
    ],
    [t('detail.studios'), item.studios.join(', ') || null],
    [t('detail.audio'), item.audioTracks.map((track) => track.title).join(', ') || null],
    [t('detail.subtitles'), item.subtitleTracks.map((track) => track.title).join(', ') || null],
  ];
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <div className={styles.details}>
      <dl className={styles.facts}>
        {shown.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {actors.length > 0 && (
        <div className={styles.cast}>
          <h3 className={styles.subheading}>{t('detail.cast')}</h3>
          <ul>
            {actors.slice(0, 20).map((person) => (
              <li key={`${person.id}-${person.role ?? ''}`}>
                <AppLink to={paths.person(person.id)} className={styles.person}>
                  {person.name}
                </AppLink>
                {person.role && <span className={styles.role}>{person.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
