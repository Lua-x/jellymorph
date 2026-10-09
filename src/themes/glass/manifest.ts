import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';
import previewLight from './preview-light.jpg';

export const glassManifest: ThemeManifest = {
  id: 'glass',
  nameKey: 'glass.name',
  descriptionKey: 'glass.description',
  // Screenshots of the demo (npm run previews); loaded only on the settings page.
  preview: { dark: previewDark, light: previewLight },
  colorSchemes: ['dark', 'light'],
  load: () => import('./index').then((module) => module.theme),
};
