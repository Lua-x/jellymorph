import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { FavoriteGroup } from '@/domain/types';
import { useThemeComponent, useThemeOptions } from '../../context';
import type { FavoritesPageProps } from '../../contract';
import styles from './SearchPage.module.css';
import { EmptyState, ErrorState, LoadingState } from './States';

function Group({ group }: { group: FavoriteGroup }) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const { cardShape } = useThemeOptions();
  const landscape =
    cardShape === 'landscape' || group.kind === 'episodes' || group.kind === 'videos';
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.groupTitle}>
        {t(`favorites.groups.${group.kind}`)}
        <span className={styles.groupCount}>{group.items.length}</span>
      </h2>
      <ul className={landscape ? `${styles.grid} ${styles.wide}` : styles.grid}>
        {group.items.map((item) => (
          <li key={item.id}>
            <MediaCard item={item} variant={landscape ? 'episode' : 'poster'} context="page" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FavoritesPage({ groups }: FavoritesPageProps) {
  const { t } = useTranslation('content');
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('favorites.title')}</h1>
      {groups.status === 'pending' && <LoadingState variant="section" />}
      {groups.status === 'error' && (
        <ErrorState variant="section" error={groups.error} onRetry={groups.retry} />
      )}
      {groups.status === 'success' && groups.data.length === 0 && (
        <EmptyState title={t('favorites.empty')} message={t('favorites.emptyHint')} />
      )}
      {groups.status === 'success' && groups.data.length > 0 && (
        <div className={styles.groups}>
          {groups.data.map((group) => (
            <Group key={group.kind} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
