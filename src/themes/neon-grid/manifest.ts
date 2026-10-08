import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const neonGridManifest: ThemeManifest = {
  id: 'neon-grid',
  nameKey: 'neon-grid.name',
  descriptionKey: 'neon-grid.description',
  // Screenshot of the demo (npm run previews); loaded only on the settings page.
  preview: { dark: previewDark },
  colorSchemes: ['dark'],
  features: { uiSounds: true },
  load: () => import('./index').then((module) => module.theme),
};
