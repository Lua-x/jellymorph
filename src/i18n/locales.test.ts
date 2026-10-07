import { describe, expect, it } from 'vitest';

const files = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', {
  eager: true,
  import: 'default',
});

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function namespaces(language: string): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const [path, content] of Object.entries(files)) {
    const match = /\.\/locales\/(\w+)\/(\w+)\.json$/.exec(path);
    if (match?.[1] === language && match[2]) result.set(match[2], content);
  }
  return result;
}

describe('translations', () => {
  const german = namespaces('de');
  const english = namespaces('en');

  it('has the same namespaces in every language', () => {
    expect([...english.keys()].sort()).toEqual([...german.keys()].sort());
  });

  for (const [namespace, content] of german) {
    it(`has the same keys in de and en for "${namespace}"`, () => {
      expect(keys(english.get(namespace)).sort()).toEqual(keys(content).sort());
    });
  }

  it('contains no empty strings', () => {
    for (const language of [german, english]) {
      for (const content of language.values()) {
        const empty = keys(content).filter((key) => {
          const value = key
            .split('.')
            .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], content);
          return value === '';
        });
        expect(empty).toEqual([]);
      }
    }
  });
});
