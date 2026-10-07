import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Imports a theme must never use: themes render data, they do not fetch it. */
const themeForbiddenImports = [
  {
    group: ['@/api', '@/api/*'],
    message: 'Themes must use the shared hooks instead of the API layer.',
  },
  {
    group: ['@jellyfin/sdk', '@jellyfin/sdk/*'],
    message: 'Themes must not depend on the Jellyfin SDK.',
  },
  { group: ['axios'], message: 'Themes must not make network requests.' },
  { group: ['@tanstack/react-query'], message: 'Themes receive QueryResult props instead.' },
  { group: ['@/mocks', '@/mocks/*'], message: 'Mocks are only loaded by the app bootstrap.' },
  { group: ['@/player/engines/*'], message: 'Themes control playback through the PlayerModel.' },
  {
    group: [
      '@/themes/neon-grid/*',
      '@/themes/crimson/*',
      '@/themes/glass/*',
      '@/themes/horizon/*',
      '@/themes/constellation/*',
    ],
    message: 'Themes may only reuse the default theme.',
  },
];

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'artifacts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.configs.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/mocks', '@/mocks/*'], message: 'Only src/app/bootstrap.ts loads mocks.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/themes/**/*.{ts,tsx}'],
    ignores: ['src/themes/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: themeForbiddenImports }],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Themes must not make network requests.' },
        { name: 'XMLHttpRequest', message: 'Themes must not make network requests.' },
        { name: 'localStorage', message: 'Themes read settings through the shared hooks.' },
        { name: 'sessionStorage', message: 'Themes read settings through the shared hooks.' },
      ],
    },
  },
  {
    files: [
      'src/api/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/domain/**/*.{ts,tsx}',
      'src/player/**/*.{ts,tsx}',
      'src/config/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/themes', '@/themes/*'],
              message: 'The headless layers must not depend on themes.',
            },
            { group: ['@/mocks', '@/mocks/*'], message: 'Only src/app/bootstrap.ts loads mocks.' },
          ],
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'scripts/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  // Tests, mocks and the bootstrap may use the mock server; this must come after the layer rules.
  {
    files: ['src/app/bootstrap.ts', 'src/mocks/**', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettier,
);
