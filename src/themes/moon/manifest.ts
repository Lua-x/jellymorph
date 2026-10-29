import type { BuiltInThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const moonManifest: BuiltInThemeManifest = {
  id: 'moon',
  nameKey: 'moon.name',
  descriptionKey: 'moon.description',
  // Screenshot of the demo (npm run previews); loaded only on the settings page.
  preview: { dark: previewDark },
  colorSchemes: ['dark'],
  load: () => import('./index').then((module) => module.theme),
};
