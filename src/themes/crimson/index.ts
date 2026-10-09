import '@fontsource-variable/inter';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { AppShell } from './components/AppShell';
import { Hero } from './components/Hero';
import { HomePage } from './components/HomePage';
import { ItemDetailPage } from './components/ItemDetailPage';
import { MediaCard } from './components/MediaCard';
import { PlayerOverlay } from './components/PlayerOverlay';
import { ProfileSelect } from './components/ProfileSelect';
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
import de from './i18n/de.json';
import en from './i18n/en.json';

/**
 * Crimson: a cinema-like home with one large hero, rows of wide cards with an enlarged preview,
 * and details as an overlay above the page. Sign-in, library, favorites, settings and the states
 * use the Classic components in Crimson colors.
 */
export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: {
    AppShell,
    ProfileSelect,
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
    detailPresentation: 'modal',
    heroItemCount: 1,
    cardShape: 'landscape',
  },
  texts: { de, en },
};
