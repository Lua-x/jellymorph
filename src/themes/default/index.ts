import '@fontsource-variable/inter';
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type CompleteThemeModule } from '../contract';
import { AppShell } from './components/AppShell';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { ProfileSelect } from './components/ProfileSelect';
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
