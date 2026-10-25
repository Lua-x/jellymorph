import '@fontsource-variable/manrope';
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
 * Cobalt: deep night blue, a title stage with a filmstrip of the featured titles, poster rows,
 * the libraries as channel tiles right below the stage and detail pages with the picture on the
 * right. Sign-in, library, search, favorites, settings, the player and the states use the
 * Classic components in Cobalt colors.
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
    cardShape: 'mixed',
  },
  texts: { de, en },
};
