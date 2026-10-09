import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const crimsonManifest: ThemeManifest = {
  id: 'crimson',
  nameKey: 'crimson.name',
  descriptionKey: 'crimson.description',
  // Screenshot of the demo (npm run previews); loaded only on the settings page.
  preview: { dark: previewDark },
  colorSchemes: ['dark'],
  load: () => import('./index').then((module) => module.theme),
};
