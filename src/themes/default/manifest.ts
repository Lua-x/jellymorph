import type { ThemeManifest } from '../contract';

export const defaultManifest: ThemeManifest = {
  id: 'default',
  nameKey: 'default.name',
  descriptionKey: 'default.description',
  preview: {},
  colorSchemes: ['dark', 'light'],
  load: () => import('./index').then((module) => module.theme),
};
