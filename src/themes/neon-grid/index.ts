import '@fontsource-variable/orbitron/wght.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-ext-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-ext-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/rajdhani/latin-ext-700.css';
import '@fontsource/share-tech-mono/index.css';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { AppShell } from './components/AppShell';
import { Hero } from './components/Hero';
import { HomePage } from './components/HomePage';
import { ItemDetailPage } from './components/ItemDetailPage';
import { LoginPage } from './components/LoginPage';
import { MediaCard } from './components/MediaCard';
import { PlayerOverlay } from './components/PlayerOverlay';
import { ProfileSelect } from './components/ProfileSelect';
import { ResumePrompt } from './components/ResumePrompt';
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { Toast } from './components/Toast';
import de from './i18n/de.json';
import en from './i18n/en.json';

/**
 * Neon Grid: HUD frames, neon glow, a perspective grid and glitch effects. Library, favorites
 * and settings use the Classic pages in Neon Grid colors and fonts.
 */
export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: {
    AppShell,
    LoginPage,
    ProfileSelect,
    HomePage,
    ItemDetailPage,
    SeriesPage,
    SearchPage,
    PlayerOverlay,
    ResumePrompt,
    Hero,
    Row,
    MediaCard,
    Toast,
    LoadingState,
    EmptyState,
    ErrorState,
  },
  options: {
    heroItemCount: 6,
  },
  texts: { de, en },
};
