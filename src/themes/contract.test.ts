import { describe, expect, it } from 'vitest';
import { THEME_CONTRACT_VERSION, THEME_SLOTS } from './contract';
import { THEMES } from './registry';

describe('theme contract', () => {
  it('registers every theme once with its name and description keys', () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const theme of THEMES) {
      expect(theme.nameKey).toBe(`${theme.id}.name`);
      expect(theme.descriptionKey).toBe(`${theme.id}.description`);
      expect(theme.colorSchemes.length).toBeGreaterThan(0);
    }
  });

  for (const manifest of THEMES) {
    describe(manifest.id, () => {
      it('loads a module for the current contract version', async () => {
        const module = await manifest.load();
        expect(module.contractVersion).toBe(THEME_CONTRACT_VERSION);
        for (const [slot, component] of Object.entries(module.components)) {
          expect(THEME_SLOTS as readonly string[]).toContain(slot);
          expect(typeof component).toBe('function');
        }
      });

      it('has a preview image for every color scheme', () => {
        for (const scheme of manifest.colorSchemes) {
          expect(manifest.preview[scheme], `${manifest.id} ${scheme}`).toMatch(/\.(jpg|png|webp)/);
        }
      });
    });
  }

  it('the default theme fills every slot, so it can stand in for any theme', async () => {
    const defaultTheme = THEMES.find((theme) => theme.id === 'default');
    const module = await defaultTheme?.load();
    expect(Object.keys(module?.components ?? {}).sort()).toEqual([...THEME_SLOTS].sort());
    expect(module?.options).toMatchObject({ detailPresentation: 'page' });
  });
});
