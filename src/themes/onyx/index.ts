import '@fontsource-variable/instrument-sans';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { classicLayout } from '../default/layout';
import { AppShell } from './components/AppShell';
import { Hero } from './components/Hero';
import { HomePage } from './components/HomePage';
import { ItemDetailPage } from './components/ItemDetailPage';
import { MediaCard } from './components/MediaCard';
import { Row } from './components/Row';
import { SeriesPage } from './components/SeriesPage';
import de from './i18n/de.json';
import en from './i18n/en.json';

/**
 * Onyx: almost black with a cool blue shimmer, a fixed side panel with text, a very tall
 * spotlight, rows of landscape cards with a ranked row of the best rated titles and the upcoming
 * episodes, and detail pages with season chips and a sideways row of episodes. Sign-in, library,
 * search, favorites, settings, the player and the states use the Classic components in Onyx
 * colors.
 */
export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: {
    AppShell,
    HomePage,
    ItemDetailPage,
    SeriesPage,
    Hero,
    Row,
    MediaCard,
  },
  options: {
    layout: {
      ...classicLayout,
      home: [
        'hero',
        'resume',
        'nextUp',
        'topRated',
        'latest',
        'upcoming',
        'libraries',
        'favorites',
        'collections',
        'genres',
      ],
      facts: [
        'year',
        'runtime',
        'officialRating',
        'communityRating',
        'videoQuality',
        'genres',
        'tagline',
        'directors',
        'cast',
        'studios',
        'audio',
        'subtitles',
      ],
    },
    heroItemCount: 6,
    cardShape: 'landscape',
  },
  texts: { de, en },
};
