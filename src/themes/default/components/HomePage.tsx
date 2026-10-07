import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Library } from '@/domain/types';
import type { HomePageProps } from '../../contract';
import styles from './HomePage.module.css';
import { Icon } from './icons';
import { EmptyState, ErrorState, LoadingState } from './States';

const KIND_ICONS = {
  movies: 'movies',
  shows: 'shows',
  collections: 'collections',
  videos: 'videos',
  mixed: 'folder',
} as const;

function LibraryTile({ library }: { library: Library }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const kind = t(`home.kinds.${library.kind}`);
  // "Filme – Filme" says nothing; only show the type when the name does not already say it.
  const showKind = kind.toLocaleLowerCase() !== library.name.toLocaleLowerCase();
  return (
    <li className={styles.tile}>
      <div className={styles.media}>
        <Icon name={KIND_ICONS[library.kind]} className={styles.fallbackIcon} />
        {library.imageUrl && !failed && (
          <img
            className={loaded ? `${styles.image} ${styles.loaded}` : styles.image}
            src={library.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => {
              setLoaded(true);
            }}
            onError={() => {
              setFailed(true);
            }}
          />
        )}
      </div>
      <div className={styles.caption}>
        <span className={styles.name}>{library.name}</span>
        {showKind && <span className={styles.kind}>{kind}</span>}
      </div>
    </li>
  );
}

export function HomePage({ user, libraries }: HomePageProps) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>
        {user.status === 'success'
          ? t('home.greeting', { name: user.data.name })
          : t('home.greetingAnonymous')}
      </h1>
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.sectionTitle}>
          {t('home.libraries')}
        </h2>
        {libraries.status === 'pending' && <LoadingState variant="section" />}
        {libraries.status === 'error' && (
          <ErrorState variant="section" error={libraries.error} onRetry={libraries.retry} />
        )}
        {libraries.status === 'success' && libraries.data.length === 0 && (
          <EmptyState title={t('home.noLibraries')} message={t('home.noLibrariesHint')} />
        )}
        {libraries.status === 'success' && libraries.data.length > 0 && (
          <ul className={styles.grid}>
            {libraries.data.map((library) => (
              <LibraryTile key={library.id} library={library} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
