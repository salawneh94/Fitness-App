import { describe, expect, it } from 'vitest';
import { GENERIC_FOODS } from './data/genericFoods';
import { normalizeFoodText, scalePer100g, searchGenericFoods, searchRecentFoods, servingLabelFor } from './foodSearch';
import type { RecentFood } from './foodHistory';

const names = (query: string, limit?: number) => searchGenericFoods(query, limit).map((f) => f.name);

describe('the staples table', () => {
  // The values were transcribed by hand, so this is the guard against a slipped digit: energy has
  // to roughly agree with the Atwater factors — 4 kcal/g protein and digestible carbs, 9 kcal/g
  // fat, and ~2 kcal/g for fibre, which is counted inside carbs but mostly isn't absorbed. (Without
  // the fibre term, USDA's own sweet corn fails.) Food-specific factors still make real foods drift
  // a little, so the tolerance allows that — and is far too narrow for a 31 typed as 13 or a 165
  // typed as 615.
  it.each(GENERIC_FOODS.map((f) => [f.name, f] as const))('%s: calories agree with its macros', (_name, food) => {
    const { calories, proteinG, carbsG, fatG, micros } = food.per100g;
    const fiberG = micros?.fiberG ?? 0;
    const fromMacros = 4 * proteinG + 4 * (carbsG - fiberG) + 2 * fiberG + 9 * fatG;
    expect(Math.abs(fromMacros - calories)).toBeLessThanOrEqual(Math.max(15, calories * 0.12));
  });

  it('has unique ids and sane servings', () => {
    expect(new Set(GENERIC_FOODS.map((f) => f.id)).size).toBe(GENERIC_FOODS.length);
    for (const f of GENERIC_FOODS) {
      for (const s of f.servings) expect(s.grams).toBeGreaterThan(0);
      // Nothing edible has more than 100 g of macronutrients in 100 g of itself.
      expect(f.per100g.proteinG + f.per100g.carbsG + f.per100g.fatG).toBeLessThanOrEqual(100.5);
    }
  });
});

describe('searchGenericFoods', () => {
  it('matches the start of words, not arbitrary substrings', () => {
    expect(names('chick')).toEqual(expect.arrayContaining(['Chicken breast, cooked', 'Chickpeas, cooked']));
    // "pea" is inside "chickPEAs" and "PEAnut", but only a word *starting* with it should match.
    expect(names('pea')).toContain('Green peas, cooked');
    expect(names('pea')).not.toContain('Chickpeas, cooked');
  });

  it('puts the food whose name starts with the query ahead of incidental matches', () => {
    // "rice" first-word matches nothing in "Brown rice"/"White rice", but both names contain it as
    // a word; neither should lose to something that only matched through an alias.
    const results = names('rice');
    expect(results.slice(0, 2).sort()).toEqual(['Brown rice, cooked', 'White rice, cooked']);
  });

  it('needs every word typed to match', () => {
    expect(names('greek yogurt nonfat')).toEqual(['Greek yogurt, plain, nonfat']);
    expect(names('chicken salmon')).toEqual([]);
  });

  it('forgives a plural and ignores case and accents', () => {
    expect(names('EGGS')[0]).toBe('Egg, whole');
    expect(names('crème')).toEqual([]); // no false positive from stripping the accent
    expect(normalizeFoodText('Crème Fraîche,  50%')).toBe('creme fraiche 50%');
  });

  it('finds foods by the other names people use for them', () => {
    expect(names('mince')).toEqual(['Ground beef 85% lean, cooked']);
    expect(names('yoghurt')).toHaveLength(2);
    expect(names('porridge')).toEqual(['Oats, rolled, dry']);
  });

  it('ranks a direct name match above an alias match', () => {
    // "beans" is a word in "Black beans" and "Green beans" — and an alias of nothing else here —
    // but "chicken" is both a name word and an alias; the name matches must come first.
    const chicken = names('chicken');
    expect(chicken[0]).toMatch(/^Chicken/);
    expect(chicken[1]).toMatch(/^Chicken/);
  });

  it('returns nothing for an empty or punctuation-only query, and respects the limit', () => {
    expect(names('')).toEqual([]);
    expect(names('  ,, ')).toEqual([]);
    expect(names('c', 3)).toHaveLength(3);
  });
});

describe('searchRecentFoods', () => {
  const recent = (name: string, brand?: string): RecentFood => ({
    name, brand, quantity: 1, calories: 100, proteinG: 1, carbsG: 1, fatG: 1, source: 'manual',
  });

  it('matches by brand as well as name, keeping history order among equals', () => {
    const recents = [recent('Protein bar', 'Quest'), recent('Overnight oats'), recent('Cookies & cream bar', 'Quest')];
    expect(searchRecentFoods(recents, 'quest').map((r) => r.name)).toEqual(['Protein bar', 'Cookies & cream bar']);
    expect(searchRecentFoods(recents, 'oats').map((r) => r.name)).toEqual(['Overnight oats']);
  });
});

describe('scalePer100g', () => {
  it('scales and rounds the way stored entries are rounded', () => {
    const banana = GENERIC_FOODS.find((f) => f.id === 'banana')!;
    expect(scalePer100g(banana.per100g, 118)).toEqual({
      calories: 105, // 89 × 1.18 = 105.02
      proteinG: 1.3,
      carbsG: 26.9,
      fatG: 0.4,
      micros: { fiberG: 3.1 },
    });
  });

  it('keeps unknown micros unknown instead of reporting zero', () => {
    const scaled = scalePer100g({ calories: 100, proteinG: 10, carbsG: 0, fatG: 6, micros: { fiberG: undefined } }, 50);
    expect(scaled).not.toHaveProperty('micros');
  });

  it('treats a negative amount as nothing rather than producing negative calories', () => {
    expect(scalePer100g({ calories: 200, proteinG: 10, carbsG: 10, fatG: 10 }, -50).calories).toBe(0);
  });
});

describe('servingLabelFor', () => {
  it('names a known serving and falls back to grams', () => {
    const servings = [{ label: '1 medium', grams: 118 }];
    expect(servingLabelFor(118, servings)).toBe('1 medium (118 g)');
    expect(servingLabelFor(150, servings)).toBe('150 g');
  });
});
