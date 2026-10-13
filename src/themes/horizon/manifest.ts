import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const horizonManifest: ThemeManifest = {
  id: 'horizon',
  nameKey: 'horizon.name',
  descriptionKey: 'horizon.description',
  // Screenshot of the demo (npm run previews); loaded only on the settings page.
  preview: { dark: previewDark },
  colorSchemes: ['dark'],
  load: () => import('./index').then((module) => module.theme),
};
