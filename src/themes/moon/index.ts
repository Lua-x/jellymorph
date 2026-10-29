import '@fontsource/anton/latin-400.css';
import '@fontsource/anton/latin-ext-400.css';
import '@fontsource/chakra-petch/latin-400.css';
import '@fontsource/chakra-petch/latin-ext-400.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-ext-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-ext-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/chakra-petch/latin-ext-700.css';
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
 * Moon: comic panels under a pale moon. Loud yellow, red and cyan on a violet night, hard
 * black ink and screen-print dots; a title card stage with numbered tabs, slanted panels for
 * cards, tiles and buttons. Sign-in, library, search, favorites, settings, the player and the
 * states use the Classic components in Moon colors and type.
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
