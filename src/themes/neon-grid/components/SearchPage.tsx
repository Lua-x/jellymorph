import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchGroup } from '@/domain/types';
import { useThemeComponent } from '../../context';
import type { SearchPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import styles from './SearchPage.module.css';
import { EmptyState, ErrorState, LoadingState } from './States';

function ResultGroup({ group }: { group: SearchGroup }) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const landscape = group.kind === 'episodes';
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.groupTitle}>
        <span className={styles.bracket} aria-hidden="true">
          [
        </span>
        {t(`search.groups.${group.kind}`)}
        <span className={styles.bracket} aria-hidden="true">
          ]
        </span>
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

/** Search as a terminal: a prompt line with a blinking cursor, results printed below. */
export function SearchPage({ term, onTermChange, results }: SearchPageProps) {
  const { t } = useTranslation('content');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const inputId = useId();
  // Caret position for the block cursor; null = after the text, -1 = a range is selected.
  const [caret, setCaret] = useState<number | null>(null);
  const syncCaret = (input: HTMLInputElement) => {
    setCaret(input.selectionStart === input.selectionEnd ? input.selectionStart : -1);
  };
  const total =
    results?.status === 'success'
      ? results.data.reduce((sum, group) => sum + group.items.length, 0)
      : 0;

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{t('search.title')}</h1>
      <form
        role="search"
        className={styles.terminal}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className={styles.titleBar} aria-hidden="true">
          <span>{tNeon('search.host')}</span>
          <span className={styles.lights}>
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className={styles.promptLine} data-empty={term === '' || undefined}>
          <label htmlFor={inputId} className={styles.prompt}>
            <span aria-hidden="true">{tNeon('search.host')}:~$ </span>
            <span className={styles.command} aria-hidden="true">
              {tNeon('search.command')}
            </span>
            <span className="visually-hidden">{t('search.label')}</span>
          </label>
          <span className={styles.inputWrap}>
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
                syncCaret(event.target);
              }}
              onSelect={(event) => {
                syncCaret(event.currentTarget);
              }}
            />
            {/* The text up to the caret, invisible, so the block cursor lands right after it. */}
            <span className={styles.overlay} aria-hidden="true">
              <span className={styles.mirror}>{term.slice(0, caret ?? term.length)}</span>
              {caret !== -1 && <span className={styles.cursor} />}
            </span>
          </span>
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
        </div>
        <p className={styles.status} role="status">
          <span aria-hidden="true">&gt; </span>
          {results === null && t('search.hint')}
          {results?.status === 'pending' && tNeon('search.idle')}
          {results?.status === 'success' && t('search.results', { count: total })}
        </p>
      </form>

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
        <div
          className={results.isRefreshing ? `${styles.groups} ${styles.refreshing}` : styles.groups}
        >
          {results.data.map((group) => (
            <ResultGroup key={group.kind} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
