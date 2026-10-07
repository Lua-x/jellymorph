/**
 * Theme contract, version 1. See docs/architecture.md §7.
 *
 * A theme is a lazily loaded module that provides React components for some or all of the
 * slots below. Missing slots fall back to the default theme. Themes receive data through
 * props and the shared hooks; they never talk to the server themselves.
 *
 * The contract grows with the project phases: phase 1 covers the shell and the sign-in
 * screens, phase 2 adds the content pages, phase 3 the player.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ThemeId } from '@/config/theme-ids';
import type {
  AppError,
  CurrentUser,
  FavoriteGroup,
  HomeSection,
  ItemDetail,
  Library,
  MediaItem,
  QueryResult,
  SearchGroup,
  Season,
} from '@/domain/types';
import type { LoginFlow, ProfileSelectModel } from '@/hooks/auth/types';
import type { LibraryBrowser } from '@/hooks/useLibraryBrowser';
import type { NavModel } from '@/navigation/nav-model';

export type { ThemeId };

export const THEME_CONTRACT_VERSION = 1;

export type ColorScheme = 'dark' | 'light';

export interface ThemeManifest {
  id: ThemeId;
  /** Key in the "themes" namespace, e.g. `default.name`. */
  nameKey: `${ThemeId}.name`;
  descriptionKey: `${ThemeId}.description`;
  /** Preview images per color scheme (asset URLs, only loaded on the settings page). */
  preview: Partial<Record<ColorScheme, string>>;
  /** Supported color schemes; the first one is the default. */
  colorSchemes: readonly [ColorScheme, ...ColorScheme[]];
  load: () => Promise<ThemeModule>;
}

export interface ThemeOptions {
  /** How item and series details open: as a page or as a modal above the previous page. */
  detailPresentation: 'page' | 'modal';
  /** Number of featured items the hero receives. */
  heroItemCount: number;
}

export interface ThemeModule {
  contractVersion: typeof THEME_CONTRACT_VERSION;
  components: Partial<ThemeComponents>;
  options?: Partial<ThemeOptions>;
}

/** The default theme must implement every slot because it is the fallback for all others. */
export interface CompleteThemeModule extends ThemeModule {
  components: ThemeComponents;
  options: ThemeOptions;
}

export interface ThemeComponents {
  AppShell: ComponentType<AppShellProps>;
  LoginPage: ComponentType<LoginPageProps>;
  ProfileSelect: ComponentType<ProfileSelectProps>;
  HomePage: ComponentType<HomePageProps>;
  LibraryPage: ComponentType<LibraryPageProps>;
  ItemDetailPage: ComponentType<ItemDetailPageProps>;
  SeriesPage: ComponentType<SeriesPageProps>;
  SearchPage: ComponentType<SearchPageProps>;
  FavoritesPage: ComponentType<FavoritesPageProps>;
  Hero: ComponentType<HeroProps>;
  Row: ComponentType<RowProps>;
  MediaCard: ComponentType<MediaCardProps>;
  Toast: ComponentType<ToastProps>;
  LoadingState: ComponentType<LoadingStateProps>;
  EmptyState: ComponentType<EmptyStateProps>;
  ErrorState: ComponentType<ErrorStateProps>;
}

export type ThemeSlot = keyof ThemeComponents;

export interface AppShellProps {
  nav: NavModel;
  children: ReactNode;
}

export interface LoginPageProps {
  flow: LoginFlow;
}

export type ProfileSelectProps = ProfileSelectModel;

/** Where a building block is rendered; 'preview' = the live preview in the settings. */
export type RenderContext = 'page' | 'preview';

/** How a detail page is presented; themes may show details as a modal over the previous page. */
export type Presentation = 'page' | 'modal';

/** Card shapes the data suggests; themes may map them to their own designs. */
export type CardVariant = 'poster' | 'landscape' | 'episode';

export interface HomePageProps {
  user: QueryResult<CurrentUser>;
  hero: QueryResult<MediaItem[]>;
  libraries: QueryResult<Library[]>;
  /** Rows in display order; each one loads independently. */
  sections: readonly HomeSection[];
}

export interface LibraryPageProps {
  browser: LibraryBrowser;
}

export interface ItemDetailPageProps {
  detail: QueryResult<ItemDetail>;
  similar: QueryResult<MediaItem[]>;
  presentation: Presentation;
  onClose: () => void;
}

export interface SeriesPageProps {
  series: ItemDetail;
  seasons: QueryResult<Season[]>;
  selectedSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: QueryResult<MediaItem[]>;
  /** The episode to watch next, null when everything is watched or nothing started. */
  nextUp: QueryResult<MediaItem | null>;
  similar: QueryResult<MediaItem[]>;
  presentation: Presentation;
  onClose: () => void;
}

export interface SearchPageProps {
  term: string;
  onTermChange: (term: string) => void;
  /** null while the term is too short to search. */
  results: QueryResult<SearchGroup[]> | null;
}

export interface FavoritesPageProps {
  groups: QueryResult<FavoriteGroup[]>;
}

export interface HeroProps {
  items: QueryResult<MediaItem[]>;
  context: RenderContext;
}

export interface RowProps {
  title: string;
  items: QueryResult<MediaItem[]>;
  variant: CardVariant;
  /** Link to the full list. */
  seeAll: string | null;
  context: RenderContext;
}

export interface MediaCardProps {
  item: MediaItem;
  variant: CardVariant;
  context: RenderContext;
}

export interface ToastProps {
  kind: 'info' | 'success' | 'error';
  message: string;
  onDismiss: () => void;
}

export interface LoadingStateProps {
  variant?: 'page' | 'section' | 'inline';
  /** Accessible description of what is loading. */
  label?: string;
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: { label: string; onAction: () => void };
}

export interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
  variant?: 'page' | 'section';
}

/** CSS custom properties every theme must define, for every color scheme it supports. */
export const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-raised',
  '--color-surface-hover',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-on-accent',
  '--color-accent-text',
  '--color-focus',
  '--color-danger',
  '--color-success',
  '--color-progress',
  '--color-overlay',
  '--font-body',
  '--font-display',
  '--font-mono',
  '--radius-card',
  '--radius-control',
  '--shadow-card',
  '--shadow-overlay',
  '--duration-fast',
  '--duration-base',
  '--duration-slow',
  '--ease-standard',
  '--ease-emphasized',
  '--focus-ring',
] as const;

/** Text/background pairs checked for WCAG AA contrast (4.5:1 for text, 3:1 for the focus color). */
export const CONTRAST_PAIRS = [
  { foreground: '--color-text', background: '--color-bg', minimum: 4.5 },
  { foreground: '--color-text', background: '--color-surface', minimum: 4.5 },
  { foreground: '--color-text', background: '--color-surface-raised', minimum: 4.5 },
  { foreground: '--color-text-muted', background: '--color-bg', minimum: 4.5 },
  { foreground: '--color-text-muted', background: '--color-surface', minimum: 4.5 },
  { foreground: '--color-accent-text', background: '--color-bg', minimum: 4.5 },
  { foreground: '--color-accent-text', background: '--color-surface', minimum: 4.5 },
  { foreground: '--color-on-accent', background: '--color-accent', minimum: 4.5 },
  { foreground: '--color-danger', background: '--color-surface', minimum: 4.5 },
  { foreground: '--color-focus', background: '--color-bg', minimum: 3 },
] as const;
