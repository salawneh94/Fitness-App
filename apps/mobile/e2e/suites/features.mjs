// Finding a food by name (your own, the built-in staples, packaged products) and tracking water.
import { createBackend, iso, openApp, profileRow } from '../lib/harness.mjs';

const wrap = { id: 'wrap', date: iso(3), meal: 'lunch', name: 'Chicken wrap', brand: null, quantity: 1, serving_label: '1 wrap', calories: 520, protein_g: 38,
  carbs_g: 45, fat_g: 18, micros: null, source: 'manual', barcode: null, logged_at: `${iso(3)}T12:00:00Z` };

export default async function ({ check, errors, shot }) {
  // ===== Food search ==================================================================================
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('food_entries', wrap);
    const app = await openApp({ backend, errors });
    const { page, state } = app;

    // Open Food Facts, stood in for: they ban clients that search on every keystroke, so how often
    // the app calls it is part of what's being tested.
    const offCalls = [];
    let offStatus = 200;
    await page.route('**/world.openfoodfacts.org/**', (route) => {
      offCalls.push(new URL(route.request().url()).searchParams.get('search_terms'));
      if (offStatus !== 200) return route.fulfill({ status: offStatus, body: 'nope' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ products: [
        { code: '5690527123456', product_name: 'Skyr Natural', brands: 'Arla, Other', serving_size: '150 g (1 pot)', serving_quantity: 150, serving_quantity_unit: 'g',
          nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } },
        { code: '111', product_name: 'Mystery bar', nutriments: {} }, // no energy value: must not be offered as a free meal
      ] }) });
    });

    await app.tab('Nutrition');
    const openLunch = async () => {
      await page.getByText('Add food').nth(1).click();
      await app.settle();
    };
    const search = page.getByPlaceholder(/Search foods/);

    await openLunch();
    await search.fill('bana');
    await app.settle(300);
    check('typing a name finds a built-in staple', (await page.getByLabel('Choose Banana').count()) === 1 && (await page.getByText('1 medium · 118 g').count()) === 1);
    check('…shown with the calories of a real portion, not of 100 g', (await page.getByLabel('Choose Banana').innerText()).includes('105 kcal'));
    check('…without calling the packaged-food service on every keystroke', offCalls.length === 0, `${offCalls.length} calls`);
    await shot(page, 'search');

    await page.getByLabel('Choose Banana').click();
    await app.settle(300);
    check('the portion defaults to the natural serving', (await page.getByText('105', { exact: true }).count()) === 1);
    await page.getByText('100 g', { exact: true }).click();
    check('a portion chip rescales the numbers', (await page.getByText('89', { exact: true }).count()) === 1);
    await page.getByText('1 medium · 118 g', { exact: true }).click();
    await page.getByText('Add to log').click();
    await app.settle();
    const banana = (await state()).foodEntries.find((f) => f.name === 'Banana');
    check('logged to the meal it was added from, with the portion', banana?.meal === 'lunch' && banana?.date === iso(0) && banana?.calories === 105 && banana?.servingLabel === '1 medium (118 g)',
      JSON.stringify(banana && { meal: banana.meal, kcal: banana.calories, serving: banana.servingLabel }));
    check('…and synced, marked as found by search', backend.find('food_entries', (r) => r.name === 'Banana')?.source === 'search');

    await openLunch();
    await search.fill('wrap');
    await app.settle(300);
    check('foods you’ve logged before come first, under "Your foods"', (await page.getByText('Your foods').count()) === 1 && (await page.getByLabel('Log Chicken wrap').count()) === 1);
    await page.getByLabel('Log Chicken wrap').click();
    await app.settle();
    const again = (await state()).foodEntries.filter((f) => f.name === 'Chicken wrap');
    check('…and log in one tap', again.length === 2 && again.some((f) => f.date === iso(0) && f.calories === 520));

    await openLunch();
    await search.fill('skyr');
    await app.settle(300);
    check('packaged foods are searched only on request', offCalls.length === 0 && (await page.getByText('Search packaged foods for “skyr”').count()) === 1);
    await page.getByText('Search packaged foods for “skyr”').click();
    await app.settle(500);
    check('…once', offCalls.length === 1 && offCalls[0] === 'skyr', JSON.stringify(offCalls));
    check('results show brand and calories per 100 g', (await page.getByLabel('Choose Skyr Natural').innerText()).includes('Arla') && (await page.getByLabel('Choose Skyr Natural').innerText()).includes('63 kcal/100g'));
    check('a product with no calorie data is left out', (await page.getByText('Mystery bar').count()) === 0);
    await page.getByLabel('Choose Skyr Natural').click();
    await app.settle(300);
    await page.getByText('Add to log').click();
    await app.settle();
    const skyr = (await state()).foodEntries.find((f) => f.name === 'Skyr Natural');
    check('a packaged food logs by its own serving, keeping brand and barcode', skyr?.calories === 95 && skyr?.brand === 'Arla' && skyr?.barcode === '5690527123456',
      JSON.stringify(skyr && { kcal: skyr.calories, brand: skyr.brand, barcode: skyr.barcode }));

    await openLunch();
    await search.fill('skyr');
    await app.settle(300);
    await page.getByText('Search packaged foods for “skyr”').click().catch(() => {});
    await app.settle(300);
    check('the same search again is answered from memory', offCalls.length === 1, `${offCalls.length} calls`);
    offStatus = 500;
    await search.fill('quark');
    await app.settle(300);
    await page.getByText('Search packaged foods for “quark”').click();
    await app.settle(500);
    check('a failed search says so and offers a retry', (await page.getByText(/Could not reach the food database/).count()) === 1 && (await page.getByText('Try again', { exact: true }).count()) === 1);
    check('…and typing it in by hand is always available', (await page.getByText('Enter “quark” manually').count()) === 1);
    await app.close();
  }

  // ===== Water ========================================================================================
  {
    const backend = createBackend().seed('profiles', profileRow());
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    await app.tab('Nutrition');
    const today = async () => (await state()).waterHistory.find((w) => w.date === iso(0))?.ml ?? 0;
    const tap = async (label) => {
      await page.getByLabel(label).click();
      await app.settle(250);
    };

    check('starts at nothing, against a 2 L drinking target', (await page.getByText('0 ml / 2 L').count()) === 1);
    check('nothing to take back yet', await page.getByLabel('Remove 250 ml').isDisabled());
    await tap(/^Add a glass/);
    await tap(/^Add a bottle/);
    check('a glass and a bottle add up', (await today()) === 750 && (await page.getByText('750 ml / 2 L').count()) === 1);
    check('…with what’s left to drink', (await page.getByText('1.25 L to go').count()) === 1);
    await tap('Remove 250 ml');
    check('a mis-tap can be taken back', (await today()) === 500);
    for (let i = 0; i < 3; i++) await page.getByLabel('Remove 250 ml').click({ force: true }).catch(() => {});
    await app.settle(300);
    check('…but never below zero', (await today()) === 0);
    for (let i = 0; i < 4; i++) await tap(/^Add a bottle/);
    check('reaching the target says so', (await today()) === 2000 && (await page.getByText('Goal reached for today.').count()) === 1);
    await shot(page, 'water');
    const rows = backend.rows('water_entries');
    check('the server holds one row for the day, at the final total', rows.length === 1 && rows[0].ml === 2000, JSON.stringify(rows.map((r) => r.ml)));
    check('…and no write was refused on the way', !backend.writes.some((w) => w.refused));
    await app.close();
  }

  // ===== Water on a training day ======================================================================
  {
    const backend = createBackend().seed('profiles', profileRow())
      .seed('workout_logs', { id: 'w', date: iso(0), workout_name: 'Upper', duration_min: 50, calories_burned: null, notes: null, exercise_logs: null, cardio: null });
    const app = await openApp({ backend, errors });
    await app.tab('Nutrition');
    check('a workout today raises the target by half a litre, and says why',
      (await app.page.getByText('0 ml / 2.5 L').count()) === 1 && (await app.page.getByText(/includes extra for today’s workout/).count()) === 1);
    await app.close();
  }
}
