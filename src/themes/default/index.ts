import '@fontsource-variable/inter';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type CompleteThemeModule } from '../contract';
import { AppShell } from './components/AppShell';
import { FavoritesPage } from './components/FavoritesPage';
import { Hero } from './components/Hero';
import { HomePage } from './components/HomePage';
import { ItemDetailPage } from './components/ItemDetailPage';
import { LibraryPage } from './components/LibraryPage';
import { LoginPage } from './components/LoginPage';
import { MediaCard } from './components/MediaCard';
import { PlayerOverlay } from './components/PlayerOverlay';
import { ProfileSelect } from './components/ProfileSelect';
import { ResumePrompt } from './components/ResumePrompt';
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
import { SettingsPage } from './components/SettingsPage';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { Toast } from './components/Toast';

/** Classic: the reference implementation of every slot and the fallback for all themes. */
export const theme: CompleteThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: {
    AppShell,
    LoginPage,
    ProfileSelect,
    HomePage,
    LibraryPage,
    ItemDetailPage,
    SeriesPage,
    SearchPage,
    FavoritesPage,
    SettingsPage,
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
    detailPresentation: 'page',
    heroItemCount: 6,
  },
};
