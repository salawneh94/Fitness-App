import type { Micronutrients } from '@fittrack/shared';

export interface ScannedProduct {
  name: string;
  brand?: string;
  barcode: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  microsPer100g: Micronutrients;
}

// Open Food Facts is a free, open, CORS-enabled product database — no API key required.
export async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};

  return {
    name: p.product_name || p.generic_name || 'Unknown product',
    brand: p.brands,
    barcode,
    caloriesPer100g: n['energy-kcal_100g'] ?? 0,
    proteinPer100g: n.proteins_100g ?? 0,
    carbsPer100g: n.carbohydrates_100g ?? 0,
    fatPer100g: n.fat_100g ?? 0,
    microsPer100g: {
      fiberG: n.fiber_100g,
      sugarG: n.sugars_100g,
      sodiumMg: n.sodium_100g ? n.sodium_100g * 1000 : undefined,
      potassiumMg: n.potassium_100g ? n.potassium_100g * 1000 : undefined,
      cholesterolMg: n.cholesterol_100g ? n.cholesterol_100g * 1000 : undefined,
      calciumMg: n.calcium_100g ? n.calcium_100g * 1000 : undefined,
      ironMg: n.iron_100g ? n.iron_100g * 1000 : undefined,
      vitaminCMg: n['vitamin-c_100g'] ? n['vitamin-c_100g'] * 1000 : undefined,
    },
  };
}
