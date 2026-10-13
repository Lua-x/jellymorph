import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, SearchGroup } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { useThemeComponent } from '../../context';
import type { SearchPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import styles from './SearchPage.module.css';

/** People get a round portrait with the name below instead of a wide card. */
function PersonTile({ person }: { person: MediaItem }) {
  return (
    <AppLink to={paths.person(person.id)} className={styles.person}>
      <span className={styles.portrait}>
        <JellyImage
          image={person.images.primary}
          sizes="8rem"
          maxWidth={320}
          fallback={
            <span className={styles.portraitFallback}>
              <Icon name="user" />
            </span>
          }
        />
      </span>
      <span className={styles.personName}>{person.name}</span>
    </AppLink>
  );
}

function ResultGroup({ group }: { group: SearchGroup }) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const people = group.kind === 'people';
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.groupTitle}>
        {t(`search.groups.${group.kind}`)}
        <span className={styles.groupCount}>{group.items.length}</span>
      </h2>
      <ul className={people ? styles.people : styles.grid}>
        {group.items.map((item) => (
          <li key={item.id}>
            {people ? (
              <PersonTile person={item} />
            ) : (
              <MediaCard
                item={item}
                variant={group.kind === 'episodes' ? 'episode' : 'landscape'}
                context="page"
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A wide search bar under the navigation, results grouped by type as wide cards. */
export function SearchPage({ term, onTermChange, results }: SearchPageProps) {
  const { t } = useTranslation('content');
  const inputId = useId();
  const total =
    results?.status === 'success'
      ? results.data.reduce((sum, group) => sum + group.items.length, 0)
      : 0;

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{t('search.title')}</h1>
      <form
        role="search"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor={inputId} className="visually-hidden">
          {t('search.label')}
        </label>
        <Icon name="search" className={styles.searchIcon} />
        <input
          id={inputId}
          type="search"
          className={styles.input}
          value={term}
          placeholder={t('search.placeholder')}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          // eslint-disable-next-line jsx-a11y-x/no-autofocus -- the page exists to type a query
          autoFocus
          onChange={(event) => {
            onTermChange(event.target.value);
          }}
        />
        {term && (
          <button
            type="button"
            className={styles.clear}
            aria-label={t('search.clear')}
            onClick={() => {
              onTermChange('');
            }}
          >
            <Icon name="close" />
          </button>
        )}
      </form>

      <p className="visually-hidden" role="status">
        {results?.status === 'success' ? t('search.results', { count: total }) : ''}
      </p>

      {results === null && <p className={styles.hint}>{t('search.hint')}</p>}
      {results?.status === 'pending' && <LoadingState variant="section" />}
      {results?.status === 'error' && (
        <ErrorState variant="section" error={results.error} onRetry={results.retry} />
      )}
      {results?.status === 'success' && results.data.length === 0 && !results.isRefreshing && (
        <EmptyState
          title={t('search.noResults', { term: term.trim() })}
          message={t('search.noResultsHint')}
        />
      )}
      {results?.status === 'success' && results.data.length > 0 && (
        <div className={styles.groups} data-refreshing={results.isRefreshing || undefined}>
          {results.data.map((group) => (
            <ResultGroup key={group.kind} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
