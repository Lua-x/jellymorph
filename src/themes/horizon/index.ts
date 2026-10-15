import '@fontsource-variable/figtree';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { classicLayout } from '../default/layout';
import { AppShell } from './components/AppShell';
import { Hero } from './components/Hero';
import { HomePage } from './components/HomePage';
import { ItemDetailPage } from './components/ItemDetailPage';
import { MediaCard } from './components/MediaCard';
import { PlayerOverlay } from './components/PlayerOverlay';
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
import de from './i18n/de.json';
import en from './i18n/en.json';

/**
 * Horizon: a solid bar with text links, a hero carousel with side arrows, rows of 16:9 cards that
 * unfold downwards, details with tabs (episodes, more like this, details). Sign-in, library,
 * favorites, settings and the states use the Classic components in Horizon colors.
 */
export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: {
    AppShell,
    HomePage,
    ItemDetailPage,
    SeriesPage,
    SearchPage,
    PlayerOverlay,
    Hero,
    Row,
    MediaCard,
  },
  options: {
    layout: {
      ...classicLayout,
      facts: [
        'communityRating',
        'year',
        'runtime',
        'officialRating',
        'videoQuality',
        'genres',
        'directors',
        'studios',
        'audio',
        'subtitles',
        'cast',
      ],
      home: [
        'hero',
        'resume',
        'libraries',
        'nextUp',
        'latest',
        'favorites',
        'collections',
        'genres',
      ],
    },
    heroItemCount: 6,
    cardShape: 'landscape',
  },
  texts: { de, en },
};
