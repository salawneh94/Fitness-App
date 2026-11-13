// Sync under the conditions that have actually broken it: more rows than one response holds, a
// write the server refuses, and no connection.
import { createBackend, iso, openApp, profileRow } from '../lib/harness.mjs';

const food = (i) => {
  const date = iso(Math.floor(i / 6));
  return { id: `f${String(i).padStart(5, '0')}`, date, meal: 'lunch', name: `Meal ${i}`, brand: null, quantity: 1, serving_label: 'plate', calories: 400,
    protein_g: 30, carbs_g: 40, fat_g: 12, micros: null, source: 'manual', barcode: null, logged_at: `${date}T12:00:00Z` };
};

export default async function ({ check, errors }) {
  // ===== A history longer than one response =========================================================
  // Hosted Supabase returns at most 1,000 rows per request. Six entries a day passes that in under
  // six months, and a full pull treats whatever came back as the complete set.
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('food_entries', Array.from({ length: 2300 }, (_, i) => food(i)));
    const app = await openApp({ backend, errors });
    let s = await app.state();
    check('a new device receives the whole history, not the first 1,000 rows', s.foodEntries.length === 2300, `got ${s.foodEntries.length} of 2300`);
    check('…fetched in pages the server will actually serve', backend.reads.filter((r) => r.table === 'food_entries').every((r) => r.limit <= 1000));
    check('…with nothing duplicated across pages', new Set(s.foodEntries.map((f) => f.id)).size === s.foodEntries.length);

    await app.reload(); // a cold start does another full pull, over what's already on the device
    s = await app.state();
    check('a cold start doesn’t prune the device back down to one page', s.foodEntries.length === 2300, `got ${s.foodEntries.length} of 2300`);
    await app.close();
  }

  // ===== A page that fails midway ====================================================================
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('food_entries', Array.from({ length: 2300 }, (_, i) => food(i)));
    const app = await openApp({ backend, errors });
    check('(setup) everything arrived', (await app.state()).foodEntries.length === 2300);
    // Next full pull: the first page of food answers, the second doesn't.
    let foodReads = 0;
    await app.page.route('**/rest/v1/food_entries**', (route) => (route.request().method() === 'GET' && ++foodReads === 2 ? route.abort('connectionreset') : route.fallback()));
    await app.reload();
    const s = await app.state();
    check('a pull that fails partway leaves the local copy alone', s.foodEntries.length === 2300, `got ${s.foodEntries.length} (second page failed after ${foodReads} reads)`);
    check('…and the profile with it', s.profile?.name === 'Sam');
    await app.close();
  }
}
