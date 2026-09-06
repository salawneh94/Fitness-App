import type { FoodEntry, MealType } from './types';

/**
 * A food the user has eaten before, ready to log again.
 *
 * Deliberately not the original FoodEntry: re-logging must create a new entry with today's date
 * and a fresh id, so this carries only the nutrition, never the identity of the old row.
 */
export type RecentFood = Omit<FoodEntry, 'id' | 'loggedAt' | 'date' | 'meal'>;

/** Same food, however it was entered. Serving matters — 100g of rice isn't a bowl of rice. */
function identityOf(entry: FoodEntry): string {
  return [entry.name.trim().toLowerCase(), entry.brand?.trim().toLowerCase() ?? '', entry.servingLabel ?? '']
    .join('|');
}

function toRecent(entry: FoodEntry): RecentFood {
  const { id: _id, loggedAt: _loggedAt, date: _date, meal: _meal, ...food } = entry;
  return food;
}

/**
 * The foods this user actually eats, most recent first, ready for one-tap re-logging.
 *
 * People eat the same twenty things. Re-entering them by hand — or re-scanning the same
 * barcode every morning — is what makes nutrition logging collapse in week two, and week two
 * is what decides whether a subscription gets a second month. This is the cheapest possible
 * fix: the data is already there, it just was never offered back.
 *
 * Foods previously eaten in the *same* meal slot come first, because that's overwhelmingly what
 * someone opening "add breakfast" wants; the rest fill in behind so the list is still useful for
 * a meal they've never logged before.
 */
export function recentFoods(entries: FoodEntry[], meal: MealType, limit = 12): RecentFood[] {
  // Newest first, so the first time an identity is seen is its most recent logging — and the
  // nutrition kept is the latest version, not a stale one from months ago.
  const newestFirst = [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

  const sameMeal: RecentFood[] = [];
  const otherMeals: RecentFood[] = [];
  const seen = new Set<string>();

  for (const entry of newestFirst) {
    const identity = identityOf(entry);
    if (seen.has(identity)) continue;
    seen.add(identity);
    (entry.meal === meal ? sameMeal : otherMeals).push(toRecent(entry));
    if (sameMeal.length >= limit) break;
  }

  return [...sameMeal, ...otherMeals].slice(0, limit);
}

/**
 * Everything logged to one meal on one day, as re-loggable foods.
 *
 * Powers "repeat yesterday" — the single most common logging action there is, because most
 * people's breakfast doesn't change.
 */
export function foodsFromDay(entries: FoodEntry[], date: string, meal: MealType): RecentFood[] {
  return entries.filter((e) => e.date === date && e.meal === meal).map(toRecent);
}
