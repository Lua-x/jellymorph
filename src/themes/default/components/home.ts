import type { HomeRow, HomeSection } from '@/domain/types';
import type { CardVariant, HomePageProps } from '../../contract';

/*
 * Helpers for home pages (phase 14): the areas arrive arranged (theme order, or the user's or
 * administrator's arrangement), and every theme draws them in that order.
 */

/** The hero (always first when shown) and the areas below it. */
export function splitHero(sections: readonly HomeSection[]): {
  heroShown: boolean;
  below: readonly HomeSection[];
} {
  const heroShown = sections[0]?.kind === 'hero';
  return { heroShown, below: heroShown ? sections.slice(1) : sections };
}

/** Nothing at all to show: no rows, no libraries, no featured titles. */
export function homeIsEmpty({ hero, libraries, sections }: HomePageProps): boolean {
  const heroShown = sections.some((section) => section.kind === 'hero');
  return (
    !sections.some((section) => section.kind !== 'hero' && section.kind !== 'libraries') &&
    libraries.status === 'success' &&
    libraries.data.length === 0 &&
    (!heroShown || hero.status !== 'pending')
  );
}

export function isRow(section: HomeSection): section is HomeRow {
  return section.kind !== 'hero' && section.kind !== 'libraries' && section.kind !== 'genres';
}

/** Poster cards, except for "continue watching" and "next up" (episodes and progress). */
export function rowVariant(kind: HomeRow['kind']): CardVariant {
  return kind === 'resume' || kind === 'nextUp' ? 'landscape' : 'poster';
}
