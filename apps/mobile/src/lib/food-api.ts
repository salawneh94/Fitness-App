import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Micronutrients, Per100g, ServingOption } from '@fittrack/shared';
import { normalizeFoodText } from '@fittrack/shared';

/** Something that can be logged by weight: a scanned product, a search hit, or a staple. */
export interface FoodCandidate {
  name: string;
  brand?: string;
  barcode?: string;
  per100g: Per100g;
  servings: ServingOption[];
  source: 'barcode' | 'search';
}

// Open Food Facts asks every app to identify itself as `AppName/Version (ContactEmail)` so heavy
// users can be contacted instead of IP-banned. Browsers don't let a page set User-Agent, so this
// only goes out from the native apps.
// TODO: append the support email once it's decided — it's one of the open launch decisions.
const USER_AGENT = `FitTrack/${Constants.expoConfig?.version ?? '1.0.0'}`;
const REQUEST_TIMEOUT_MS = 10_000;

async function offFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: Platform.OS === 'web' ? undefined : { 'User-Agent': USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }
}

function num(value: unknown): number | undefined {
  // OFF data is crowd-sourced: the same field arrives as a number on one product and a string on
  // the next, and occasionally as garbage.
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Product names are plain strings on the product API, but per-language objects on some search
 * backends (`{ main, en, fr }`) — accept either, so switching endpoints can't break parsing. */
function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return text(v.main) ?? text(v.en) ?? text(Object.values(v).find((x) => typeof x === 'string'));
  }
  return undefined;
}

function firstBrand(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const brand = typeof raw === 'string' ? raw.split(',')[0].trim() : undefined;
  return brand || undefined;
}

const mg = (grams: number | undefined) => (grams === undefined ? undefined : Math.round(grams * 1000 * 10) / 10);

/**
 * Turn an Open Food Facts product into something loggable, or null when it can't be.
 *
 * A product with no energy value is dropped rather than shown as 0 kcal: logging it would record
 * a meal as free, which is worse than not finding it at all.
 */
export function candidateFromOff(p: Record<string, any>, source: FoodCandidate['source']): FoodCandidate | null {
  const n: Record<string, unknown> = p.nutriments ?? {};
  // Some products only carry kJ (`energy_100g` is also kJ in OFF's schema).
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined);
  if (kcal === undefined) return null;

  const salt = num(n.salt_100g);
  const sodium = num(n.sodium_100g) ?? (salt !== undefined ? salt / 2.5 : undefined);
  const micros: Micronutrients = {
    fiberG: num(n.fiber_100g),
    sugarG: num(n.sugars_100g),
    sodiumMg: mg(sodium),
    potassiumMg: mg(num(n.potassium_100g)),
    cholesterolMg: mg(num(n.cholesterol_100g)),
    calciumMg: mg(num(n.calcium_100g)),
    ironMg: mg(num(n.iron_100g)),
    vitaminCMg: mg(num(n['vitamin-c_100g'])),
  };

  const servingGrams = num(p.serving_quantity);
  const servingUnit = typeof p.serving_quantity_unit === 'string' ? p.serving_quantity_unit.toLowerCase() : 'g';
  const servings: ServingOption[] =
    servingGrams && servingGrams > 0 && (servingUnit === 'g' || servingUnit === 'ml')
      ? [{ label: text(p.serving_size)?.replace(/\s*\(.*\)\s*$/, '') || '1 serving', grams: servingGrams }]
      : [];

  return {
    name: text(p.product_name) ?? text(p.generic_name) ?? 'Unknown product',
    brand: firstBrand(p.brands),
    barcode: typeof p.code === 'string' ? p.code : undefined,
    per100g: {
      calories: Math.round(kcal),
      proteinG: num(n.proteins_100g) ?? 0,
      carbsG: num(n.carbohydrates_100g) ?? 0,
      fatG: num(n.fat_100g) ?? 0,
      micros,
    },
    servings,
    source,
  };
}

// Open Food Facts is a free, open, CORS-enabled product database — no API key required.
export async function lookupBarcode(barcode: string): Promise<FoodCandidate | null> {
  const res = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  // A product with no nutrition on file still deserves its name on the confirm screen, so the
  // user knows the scan worked and can fill the numbers in — unlike a search hit, which is
  // just skipped.
  return (
    candidateFromOff({ code: barcode, ...data.product }, 'barcode') ?? {
      name: text(data.product.product_name) ?? 'Unknown product',
      brand: firstBrand(data.product.brands),
      barcode,
      per100g: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      servings: [],
      source: 'barcode',
    }
  );
}

// --- search ---------------------------------------------------------------------------------

/**
 * Open Food Facts allows 10 search requests per minute, per user, and bans IPs that exceed it —
 * their docs say in so many words not to build search-as-you-type on it. So remote search only
 * runs when the user asks for it, and this keeps a margin under the limit on top of that: a
 * banned user would lose barcode scanning too, since it's the same host.
 */
const SEARCH_LIMIT = 8;
const SEARCH_WINDOW_MS = 60_000;
const recentSearchTimes: number[] = [];
const searchCache = new Map<string, FoodCandidate[]>();

export class SearchRateLimitedError extends Error {
  constructor(public readonly retryInSec: number) {
    super(`Too many searches — try again in ${retryInSec}s`);
  }
}

export async function searchProducts(query: string): Promise<FoodCandidate[]> {
  const key = normalizeFoodText(query);
  if (!key) return [];
  const cached = searchCache.get(key);
  if (cached) return cached;

  const now = Date.now();
  while (recentSearchTimes.length && now - recentSearchTimes[0] > SEARCH_WINDOW_MS) recentSearchTimes.shift();
  if (recentSearchTimes.length >= SEARCH_LIMIT) {
    throw new SearchRateLimitedError(Math.ceil((SEARCH_WINDOW_MS - (now - recentSearchTimes[0])) / 1000));
  }
  recentSearchTimes.push(now);

  const params = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '24',
    fields: 'code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit',
  });
  const res = await offFetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
  if (res.status === 429) throw new SearchRateLimitedError(60);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();

  const results = (Array.isArray(data.products) ? data.products : [])
    .map((p: Record<string, any>) => candidateFromOff(p, 'search'))
    .filter((c: FoodCandidate | null): c is FoodCandidate => c !== null);

  if (searchCache.size >= 30) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, results);
  return results;
}
