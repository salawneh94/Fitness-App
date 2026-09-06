import { describe, expect, it } from 'vitest';
import { foodsFromDay, recentFoods } from './foodHistory';
import type { FoodEntry, MealType } from './types';

let seq = 0;
function entry(over: Partial<FoodEntry> & { name: string; meal: MealType }): FoodEntry {
  seq += 1;
  return {
    id: `id-${seq}`,
    date: '2026-09-01',
    quantity: 1,
    servingLabel: 'serving',
    calories: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
    source: 'manual',
    loggedAt: `2026-09-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
    ...over,
  };
}

describe('recentFoods', () => {
  it('returns most recently logged first', () => {
    const entries = [
      entry({ name: 'Oats', meal: 'breakfast', loggedAt: '2026-09-01T08:00:00.000Z' }),
      entry({ name: 'Eggs', meal: 'breakfast', loggedAt: '2026-09-03T08:00:00.000Z' }),
      entry({ name: 'Toast', meal: 'breakfast', loggedAt: '2026-09-02T08:00:00.000Z' }),
    ];
    expect(recentFoods(entries, 'breakfast').map((f) => f.name)).toEqual(['Eggs', 'Toast', 'Oats']);
  });

  it('de-duplicates a food eaten many times', () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      entry({ name: 'Oats', meal: 'breakfast', loggedAt: `2026-09-${String(i + 1).padStart(2, '0')}T08:00:00.000Z` })
    );
    const result = recentFoods(entries, 'breakfast');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Oats');
  });

  it('keeps the most recent nutrition for a repeated food, not the oldest', () => {
    const entries = [
      entry({ name: 'Protein shake', meal: 'snack', calories: 150, loggedAt: '2026-01-01T08:00:00.000Z' }),
      entry({ name: 'Protein shake', meal: 'snack', calories: 220, loggedAt: '2026-09-01T08:00:00.000Z' }),
    ];
    expect(recentFoods(entries, 'snack')[0].calories).toBe(220);
  });

  it('treats different servings of the same food as different foods', () => {
    const entries = [
      entry({ name: 'Rice', meal: 'lunch', servingLabel: '100g', calories: 130 }),
      entry({ name: 'Rice', meal: 'lunch', servingLabel: 'bowl', calories: 340 }),
    ];
    expect(recentFoods(entries, 'lunch')).toHaveLength(2);
  });

  it('treats the same food from different brands as different foods', () => {
    const entries = [
      entry({ name: 'Greek yogurt', brand: 'Fage', meal: 'breakfast' }),
      entry({ name: 'Greek yogurt', brand: 'Chobani', meal: 'breakfast' }),
    ];
    expect(recentFoods(entries, 'breakfast')).toHaveLength(2);
  });

  it('ignores case and surrounding whitespace when matching', () => {
    const entries = [
      entry({ name: 'Oats', meal: 'breakfast', loggedAt: '2026-09-01T08:00:00.000Z' }),
      entry({ name: '  oats ', meal: 'breakfast', loggedAt: '2026-09-02T08:00:00.000Z' }),
    ];
    expect(recentFoods(entries, 'breakfast')).toHaveLength(1);
  });

  it('puts foods from the same meal slot ahead of newer ones from other slots', () => {
    const entries = [
      entry({ name: 'Oats', meal: 'breakfast', loggedAt: '2026-09-01T08:00:00.000Z' }),
      entry({ name: 'Steak', meal: 'dinner', loggedAt: '2026-09-05T19:00:00.000Z' }),
    ];
    // Steak is more recent, but someone opening "add breakfast" wants breakfast foods.
    expect(recentFoods(entries, 'breakfast').map((f) => f.name)).toEqual(['Oats', 'Steak']);
  });

  it('still offers other meals when the slot has no history of its own', () => {
    const entries = [entry({ name: 'Steak', meal: 'dinner' }), entry({ name: 'Oats', meal: 'breakfast' })];
    expect(recentFoods(entries, 'snack').map((f) => f.name).sort()).toEqual(['Oats', 'Steak']);
  });

  it('respects the limit', () => {
    const entries = Array.from({ length: 40 }, (_, i) => entry({ name: `Food ${i}`, meal: 'lunch' }));
    expect(recentFoods(entries, 'lunch', 5)).toHaveLength(5);
  });

  it('fills the limit from the requested meal before falling back', () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => entry({ name: `Lunch ${i}`, meal: 'lunch' })),
      ...Array.from({ length: 8 }, (_, i) => entry({ name: `Dinner ${i}`, meal: 'dinner' })),
    ];
    const result = recentFoods(entries, 'lunch', 5);
    expect(result.every((f) => f.name.startsWith('Lunch'))).toBe(true);
  });

  it('strips the identity of the original entry so re-logging cannot duplicate a row', () => {
    const result = recentFoods([entry({ name: 'Oats', meal: 'breakfast' })], 'breakfast')[0];
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('loggedAt');
    expect(result).not.toHaveProperty('date');
    expect(result).not.toHaveProperty('meal');
  });

  it('handles an empty history', () => {
    expect(recentFoods([], 'breakfast')).toEqual([]);
  });
});

describe('foodsFromDay', () => {
  const entries = [
    entry({ name: 'Oats', meal: 'breakfast', date: '2026-09-04' }),
    entry({ name: 'Eggs', meal: 'breakfast', date: '2026-09-04' }),
    entry({ name: 'Salad', meal: 'lunch', date: '2026-09-04' }),
    entry({ name: 'Pancakes', meal: 'breakfast', date: '2026-09-05' }),
  ];

  it('returns only that day and that meal', () => {
    expect(foodsFromDay(entries, '2026-09-04', 'breakfast').map((f) => f.name)).toEqual(['Oats', 'Eggs']);
  });

  it('keeps duplicates, unlike the recents list', () => {
    // Two coffees yesterday means two coffees when you repeat the day.
    const twice = [
      entry({ name: 'Coffee', meal: 'breakfast', date: '2026-09-04' }),
      entry({ name: 'Coffee', meal: 'breakfast', date: '2026-09-04' }),
    ];
    expect(foodsFromDay(twice, '2026-09-04', 'breakfast')).toHaveLength(2);
  });

  it('returns nothing for a day with no entries', () => {
    expect(foodsFromDay(entries, '2020-01-01', 'breakfast')).toEqual([]);
  });
});
