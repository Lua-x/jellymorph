import { expect, test as base } from '@playwright/test';

export { expect };
export type { Locator, Page } from '@playwright/test';

/**
 * `test` for the functional specs: fails a test when the browser reports a Content Security
 * Policy violation. `vite preview` sends no CSP; the container run (E2E_BASE_URL, see
 * scripts/test-container.ts) does, so the same tests prove that the policy fits the app.
 */
export const test = base.extend<{ cspGuard: undefined }>({
  cspGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
          violations.push(message.text());
        }
      });
      await use(undefined);
      expect(violations, 'Content Security Policy violations').toEqual([]);
    },
    { auto: true },
  ],
});
