import type { Micronutrients } from './types';
import type { RecentFood } from './foodHistory';
import { GENERIC_FOODS } from './data/genericFoods';

/** Nutrition for 100 g of a food — the unit every database (USDA, Open Food Facts) reports in. */
export interface Per100g {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micros?: Micronutrients;
}

/** A natural portion of a food, as people think of it: "1 medium" rather than "118 g". */
export interface ServingOption {
  label: string;
  grams: number;
}

export interface GenericFood {
  id: string;
  name: string;
  /** Other words people type for it: "mince" for ground beef, "yoghurt" for yogurt. */
  aliases?: string[];
  per100g: Per100g;
  servings: ServingOption[];
}

/** Lowercase, accents stripped, punctuation turned to spaces: "Crème fraîche," → "creme fraiche". */
export function normalizeFoodText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  const normalized = normalizeFoodText(text);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Does every word typed start some word of the candidate?
 *
 * Word-prefix rather than substring, so "chick" finds "chicken" and "chickpeas" but "pea" doesn't
 * drag in "peanut butter" via "chickpeas". A trailing plural "s" on the query is forgiven ("eggs"
 * finds "Egg, whole"), because people type plurals and the table names things in the singular.
 */
function allTokensMatch(queryTokens: string[], candidateWords: string[]): boolean {
  return queryTokens.every((q) => {
    const singular = q.length > 3 && q.endsWith('s') ? q.slice(0, -1) : null;
    return candidateWords.some((w) => w.startsWith(q) || (singular !== null && w.startsWith(singular)));
  });
}

/**
 * Rank how well `query` matches a food name and its aliases. Lower is better; null is no match.
 *
 *   0  the name is exactly what was typed
 *   1  the name starts with what was typed — "greek yo" → "Greek yogurt, plain, nonfat"
 *   2  the first word of the name matches — "chicken" → "Chicken breast" before "Turkey…"
 *   3  every typed word matches some word of the name
 *   4  the match came only through an alias — "mince" → "Ground beef"
 */
function matchRank(queryTokens: string[], query: string, name: string, aliases: string[] = []): number | null {
  const nameNorm = normalizeFoodText(name);
  const nameWords = nameNorm.split(' ');
  if (nameNorm === query) return 0;
  if (nameNorm.startsWith(query)) return 1;
  if (allTokensMatch(queryTokens, nameWords)) {
    return allTokensMatch(queryTokens.slice(0, 1), nameWords.slice(0, 1)) ? 2 : 3;
  }
  for (const alias of aliases) {
    if (allTokensMatch(queryTokens, tokens(alias))) return 4;
  }
  return null;
}

function rankAndTake<T>(items: T[], query: string, nameOf: (item: T) => string, aliasesOf: (item: T) => string[] | undefined, limit: number): T[] {
  const q = normalizeFoodText(query);
  const queryTokens = q ? q.split(' ') : [];
  if (queryTokens.length === 0) return [];

  const ranked: { item: T; rank: number; index: number }[] = [];
  items.forEach((item, index) => {
    const rank = matchRank(queryTokens, q, nameOf(item), aliasesOf(item));
    if (rank !== null) ranked.push({ item, rank, index });
  });
  // Ties keep the input order, which is meaningful on both sides: the staples table lists the most
  // commonly eaten variant first ("Egg, whole" before "Egg white"), and recents are most recently
  // eaten first. Breaking ties on name length instead put egg whites first for "eggs".
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((r) => r.item);
}

/** Search the built-in staples table. Instant and offline, so it runs on every keystroke. */
export function searchGenericFoods(query: string, limit = 8, foods: GenericFood[] = GENERIC_FOODS): GenericFood[] {
  return rankAndTake(foods, query, (f) => f.name, (f) => f.aliases, limit);
}

/**
 * Filter the user's own history by what they've typed — their brands and their meals, which no
 * database knows about, so these rank ahead of everything else in the results.
 */
export function searchRecentFoods(recents: RecentFood[], query: string, limit = 5): RecentFood[] {
  return rankAndTake(recents, query, (f) => f.name, (f) => (f.brand ? [f.brand] : undefined), limit);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrition for `grams` of a food described per 100 g.
 *
 * Calories round to whole numbers and macros to one decimal, matching how the rest of the app
 * stores entries. Micros that are absent stay absent rather than becoming 0 — "unknown" and
 * "none" are different things, and the micronutrient list treats them differently.
 */
export function scalePer100g(per100g: Per100g, grams: number): Required<Omit<Per100g, 'micros'>> & { micros?: Micronutrients } {
  const factor = Math.max(0, grams) / 100;
  const micros = per100g.micros
    ? (Object.fromEntries(
        Object.entries(per100g.micros)
          .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
          .map(([k, v]) => [k, round1((v as number) * factor)])
      ) as Micronutrients)
    : undefined;
  return {
    calories: Math.round(per100g.calories * factor),
    proteinG: round1(per100g.proteinG * factor),
    carbsG: round1(per100g.carbsG * factor),
    fatG: round1(per100g.fatG * factor),
    ...(micros && Object.keys(micros).length > 0 ? { micros } : {}),
  };
}

/** How a gram amount reads in the log: "1 medium (118 g)" when it's exactly a known serving. */
export function servingLabelFor(grams: number, servings: ServingOption[]): string {
  const g = Math.round(grams * 10) / 10;
  const match = servings.find((s) => Math.abs(s.grams - g) < 0.05);
  return match ? `${match.label} (${g} g)` : `${g} g`;
}
