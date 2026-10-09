import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryBrowser, LibraryFilters, SortField } from '@/hooks/useLibraryBrowser';
import { VirtualGrid, type VirtualGridHandle } from '@/ui/VirtualGrid';
import { useThemeComponent, useThemeOptions } from '../../context';
import type { CardVariant, LibraryPageProps } from '../../contract';
import { Button } from './Button';
import { Icon } from './icons';
import styles from './LibraryPage.module.css';
import { MediaCardSkeleton } from './MediaCard';
import { EmptyState, ErrorState } from './States';

const SORT_FIELDS: SortField[] = ['name', 'dateAdded', 'year', 'rating'];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function FilterPanel({ browser, id }: { browser: LibraryBrowser; id: string }) {
  const { t } = useTranslation('content');
  const { filters, filterOptions } = browser;
  const set = (change: Partial<LibraryFilters>) => {
    browser.setFilters({ ...filters, ...change });
  };
  const options =
    filterOptions.status === 'success' ? filterOptions.data : { genres: [], years: [] };

  return (
    <div id={id} className={styles.panel}>
      <fieldset className={styles.group}>
        <legend>{t('library.status')}</legend>
        <div className={styles.chips}>
          {(['all', 'unplayed', 'played'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.chip}
              aria-pressed={filters.played === value}
              onClick={() => {
                set({ played: value });
              }}
            >
              {t(`library.played.${value}`)}
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            aria-pressed={filters.favoritesOnly}
            onClick={() => {
              set({ favoritesOnly: !filters.favoritesOnly });
            }}
          >
            <Icon name="heart" filled={filters.favoritesOnly} />
            {t('library.favoritesOnly')}
          </button>
        </div>
      </fieldset>
      {options.genres.length > 0 && (
        <fieldset className={styles.group}>
          <legend>{t('library.genres')}</legend>
          <div className={styles.chips}>
            {options.genres.map((genre) => (
              <button
                key={genre}
                type="button"
                className={styles.chip}
                aria-pressed={filters.genres.includes(genre)}
                onClick={() => {
                  set({ genres: toggle(filters.genres, genre) });
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {options.years.length > 0 && (
        <fieldset className={styles.group}>
          <legend>{t('library.years')}</legend>
          <div className={`${styles.chips} ${styles.years}`}>
            {options.years.map((year) => (
              <button
                key={year}
                type="button"
                className={styles.chip}
                aria-pressed={filters.years.includes(year)}
                onClick={() => {
                  set({ years: toggle(filters.years, year) });
                }}
              >
                {year}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function ActiveFilters({ browser }: { browser: LibraryBrowser }) {
  const { t } = useTranslation('content');
  const { filters } = browser;
  if (browser.activeFilterCount === 0) return null;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.genres.map((genre) => ({
      key: `genre-${genre}`,
      label: genre,
      remove: () => {
        browser.setFilters({
          ...filters,
          genres: filters.genres.filter((entry) => entry !== genre),
        });
      },
    })),
    ...filters.years.map((year) => ({
      key: `year-${String(year)}`,
      label: String(year),
      remove: () => {
        browser.setFilters({ ...filters, years: filters.years.filter((entry) => entry !== year) });
      },
    })),
    ...(filters.played === 'all'
      ? []
      : [
          {
            key: 'played',
            label: t(`library.played.${filters.played}`),
            remove: () => {
              browser.setFilters({ ...filters, played: 'all' });
            },
          },
        ]),
    ...(filters.favoritesOnly
      ? [
          {
            key: 'favorites',
            label: t('library.favoritesOnly'),
            remove: () => {
              browser.setFilters({ ...filters, favoritesOnly: false });
            },
          },
        ]
      : []),
  ];
  return (
    <ul className={styles.active} aria-label={t('library.activeFilters')}>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            className={styles.activeChip}
            aria-label={t('library.removeFilter', { name: chip.label })}
            onClick={chip.remove}
          >
            {chip.label}
            <Icon name="close" />
          </button>
        </li>
      ))}
      <li>
        <button type="button" className={styles.clear} onClick={browser.clearFilters}>
          {t('library.clearFilters')}
        </button>
      </li>
    </ul>
  );
}

export function LibraryPage({ browser }: LibraryPageProps) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const { cardShape } = useThemeOptions();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const gridRef = useRef<VirtualGridHandle>(null);
  const panelId = useId();
  const sortId = useId();
  const { heading, total } = browser;
  const title = heading.status === 'success' ? heading.data.title : '';
  const variant: CardVariant =
    cardShape === 'landscape' ||
    (heading.status === 'success' && heading.data.libraryKind === 'videos')
      ? 'landscape'
      : 'poster';

  if (heading.status === 'error') {
    return <ErrorState error={heading.error} onRetry={heading.retry} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titles}>
          {heading.status === 'success' && heading.data.kind !== 'library' && (
            <span className={styles.kicker}>{t(`library.kinds.${heading.data.kind}`)}</span>
          )}
          <h1 className={styles.title}>{title || ' '}</h1>
          <p className={styles.count} aria-live="polite">
            {total.status === 'success' ? t('library.items', { count: total.data }) : ' '}
          </p>
        </div>
        <div className={styles.toolbar}>
          <label htmlFor={sortId} className="visually-hidden">
            {t('library.sort')}
          </label>
          <span className={styles.selectWrap}>
            <select
              id={sortId}
              className={styles.select}
              value={browser.sort}
              onChange={(event) => {
                browser.setSort(event.target.value as SortField);
              }}
            >
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {t(`library.sortFields.${field}`)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" className={styles.selectIcon} />
          </span>
          <Button
            variant="secondary"
            aria-label={browser.descending ? t('library.descending') : t('library.ascending')}
            title={browser.descending ? t('library.descending') : t('library.ascending')}
            icon={<Icon name={browser.descending ? 'arrowDown' : 'arrowUp'} />}
            onClick={() => {
              browser.setSort(browser.sort, !browser.descending);
            }}
          />
          <Button
            variant="secondary"
            icon={<Icon name="filter" />}
            aria-expanded={filtersOpen}
            aria-controls={panelId}
            onClick={() => {
              setFiltersOpen((open) => !open);
            }}
          >
            {browser.activeFilterCount > 0
              ? t('library.filterCount', { count: browser.activeFilterCount })
              : t('library.filters')}
          </Button>
        </div>
      </header>

      {filtersOpen && <FilterPanel browser={browser} id={panelId} />}
      <ActiveFilters browser={browser} />

      <div className={styles.body}>
        <div className={styles.gridArea}>
          {total.status === 'pending' && (
            <div className={styles.skeletonGrid} aria-busy="true">
              {Array.from({ length: 12 }, (_, index) => (
                <MediaCardSkeleton key={index} variant={variant} />
              ))}
            </div>
          )}
          {total.status === 'error' && (
            <ErrorState variant="section" error={total.error} onRetry={total.retry} />
          )}
          {total.status === 'success' && total.data === 0 && (
            <EmptyState
              title={browser.activeFilterCount > 0 ? t('library.noResults') : t('library.empty')}
              message={browser.activeFilterCount > 0 ? t('library.noResultsHint') : undefined}
              action={
                browser.activeFilterCount > 0
                  ? { label: t('library.clearFilters'), onAction: browser.clearFilters }
                  : undefined
              }
            />
          )}
          {total.status === 'success' && total.data > 0 && (
            <VirtualGrid
              handleRef={gridRef}
              count={total.data}
              minColumnWidth={variant === 'poster' ? 9.5 : 16}
              aspectRatio={variant === 'poster' ? 2 / 3 : 16 / 9}
              extraHeight={3.25}
              gap={1.25}
              label={t('library.grid', { name: title })}
              resetKey={browser.resultKey}
              onRangeChange={browser.requestRange}
              renderItem={(index) => {
                const item = browser.itemAt(index);
                return item ? (
                  <MediaCard item={item} variant={variant} context="page" />
                ) : (
                  <MediaCardSkeleton variant={variant} />
                );
              }}
            />
          )}
        </div>
        {browser.jumpLetters && total.status === 'success' && total.data > 24 && (
          <nav className={styles.jump} aria-label={t('library.jumpBar')}>
            {browser.jumpLetters.map((letter) => (
              <button
                key={letter}
                type="button"
                className={styles.letter}
                aria-label={t('library.jumpTo', { letter })}
                onClick={() => {
                  void browser.jumpTo(letter).then((index) => {
                    gridRef.current?.focusIndex(index);
                  });
                }}
              >
                {letter}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
