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
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
import de from './i18n/de.json';
import en from './i18n/en.json';

/**
 * Glass: frosted surfaces, a centered pill for the sections, a full-screen hero carousel and
 * cards that lift and lean towards the pointer, in a dark and a light scheme. Sign-in, library,
 * favorites, settings and the states use the Classic components in Glass colors.
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
    heroItemCount: 6,
  },
  texts: { de, en },
};
