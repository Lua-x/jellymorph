/**
 * The theme module: what Jellymorph loads from index.js. Slots left out of `components` are
 * drawn by Classic in this theme's tokens (tokens.css), so a theme can start small and grow.
 * See docs/themes.md in the Jellymorph repository for every slot and its props.
 */
import { THEME_CONTRACT_VERSION, type ThemeModule } from 'jellymorph';
import { Hero } from './Hero';
import de from './i18n/de.json';
import en from './i18n/en.json';
import { MediaCard } from './MediaCard';
import './tokens.css';

const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: { Hero, MediaCard },
  // One title on the stage; posters for films and series, wide cards for episodes.
  options: { heroItemCount: 1, cardShape: 'mixed' },
  // Registered as namespace "theme-<id>": useTranslation('theme-starter').
  texts: { de, en },
};

export default theme;
