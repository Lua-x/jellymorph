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
import { ProfileSelect } from './components/ProfileSelect';
import { Row } from './components/Row';
import { SearchPage } from './components/SearchPage';
import { SeriesPage } from './components/SeriesPage';
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
