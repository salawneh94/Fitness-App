// The Overview quick log (past days, and not inventing weigh-ins), the goal forecast, and undoing
// a saved-meal delete.
import { UID, chip, createBackend, daysAgo, iso, openApp, profileRow } from '../lib/harness.mjs';

export default async function ({ check, errors, shot }) {
  // ===== Quick log =====================================================================================
  {
    const backend = createBackend()
      .seed('profiles', profileRow())
      .seed('weight_entries', { date: iso(2), weight_kg: 84 })
      .seed('steps_entries', { date: iso(2), steps: 9100 })
      .seed('saved_meals', { id: 'm1', name: 'Usual breakfast', created_at: '2026-09-01T00:00:00Z',
        items: [{ name: 'Oats', quantity: 1, calories: 300, proteinG: 10, carbsG: 50, fatG: 6, servingLabel: 'bowl', meal: 'breakfast', source: 'manual' }] });
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    const weight = page.getByLabel('Weight', { exact: true });
    const save = () => page.getByText('Save', { exact: true }).first().click();

    check('today’s weight is empty — the last weigh-in is only a hint', (await weight.inputValue()) === '' && (await weight.getAttribute('placeholder')) === '84',
      `value="${await weight.inputValue()}" placeholder="${await weight.getAttribute('placeholder')}"`);
    check('Save is disabled with nothing entered', await page.getByText('Save', { exact: true }).first().evaluate((el) => el.closest('[aria-disabled]')?.getAttribute('aria-disabled') === 'true'));

    await page.getByRole('radio', { name: chip(2) }).click();
    await app.settle(200);
    check('a past day loads what was logged that day', (await weight.inputValue()) === '84' && (await page.getByLabel('Steps', { exact: true }).inputValue()) === '9100');
    check('…under a title that says so', (await page.getByText('Log a past day').count()) === 1);

    // Backfill five days ago: earlier than the latest weigh-in, so the current weight mustn't change.
    await page.getByRole('radio', { name: chip(5) }).click();
    await app.settle(200);
    check('a day with nothing logged starts empty', (await weight.inputValue()) === '' && (await page.getByLabel('Steps', { exact: true }).inputValue()) === '');
    await weight.fill('85');
    await page.getByLabel('Sleep in hours', { exact: true }).fill('7.5');
    await save();
    await app.settle();
    let s = await state();
    check('backfilled weigh-in and sleep land on that day', s.weightHistory.some((w) => w.date === iso(5) && w.weightKg === 85) && s.sleepHistory.some((x) => x.date === iso(5) && x.hours === 7.5));
    check('no steps were invented for it', !s.stepsHistory.some((x) => x.date === iso(5)));
    check('current weight still follows the latest weigh-in, not the last typed', s.profile.weightKg === 84, `profile.weightKg=${s.profile.weightKg}`);
    check('synced as that day’s row', backend.find('weight_entries', (r) => r.date === iso(5))?.weight_kg === 85 && backend.find('sleep_entries', (r) => r.date === iso(5))?.hours === 7.5);
    check('Overview counts change from the earliest weigh-in, by date',
      (await page.getByText(`kg since ${daysAgo(5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`).count()) === 1);

    await page.getByRole('radio', { name: 'Today' }).click();
    await app.settle(200);
    await page.getByLabel('Steps', { exact: true }).fill('4000');
    await save();
    await app.settle();
    s = await state();
    check('steps alone log no weigh-in for today', !s.weightHistory.some((w) => w.date === iso(0)) && s.stepsHistory.some((x) => x.date === iso(0) && x.steps === 4000));
    await weight.fill('83.5');
    await save();
    await app.settle();
    s = await state();
    check('a weigh-in today becomes the current weight', s.profile.weightKg === 83.5 && backend.find('profiles', (r) => r.id === UID)?.weight_kg === 83.5);
    await shot(page, 'quicklog');

    // Saving Settings without touching weight: nothing invented, and the plan isn't dropped.
    await app.tab('Profile');
    const before = (await state()).weightHistory.length;
    await page.getByText('Save Changes').click();
    await app.settle();
    check('saving Settings logs no weigh-in', (await state()).weightHistory.length === before);

    // ===== Saved meal undo =============================================================================
    await app.tab('Nutrition');
    await page.getByLabel('Delete Usual breakfast').click();
    await app.settle(200);
    check('deleting a saved meal offers undo', (await page.getByText('Deleted Usual breakfast').count()) === 1);
    await app.settle(800); // let the delete reach the server first — the harder case
    const goneOnServer = !backend.find('saved_meals', (r) => r.id === 'm1');
    await page.getByLabel('Undo: Deleted Usual breakfast').click();
    await app.settle(800);
    check('undo restores it, same id and items', (await state()).savedMeals.some((m) => m.id === 'm1' && m.items.length === 1));
    check('…and recreates the server row', goneOnServer && backend.find('saved_meals', (r) => r.id === 'm1')?.name === 'Usual breakfast', `deleted on server first: ${goneOnServer}`);
    check('restored meal is usable again', (await page.getByLabel('Log Usual breakfast as breakfast').count()) === 1);

    // ===== Forecast without enough data ================================================================
    await app.tab('Progress');
    check('forecast explains what it needs first', (await page.getByText('Forecast for 78.0 kg').count()) === 1);
    await app.close();
  }

  // ===== Settings keeps the active plan ================================================================
  {
    const backend = createBackend()
      .seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: iso(6) }))
      .seed('weight_entries', { date: iso(4), weight_kg: 84 });
    const app = await openApp({ backend, errors });
    await app.tab('Profile');
    await app.page.getByText('Save Changes').click();
    await app.settle();
    const s = await app.state();
    check('saving Settings keeps the active plan', s.profile.activePlan?.templateId === 'full-body', JSON.stringify(s.profile.activePlan));
    check('…on the server too', backend.find('profiles', (r) => r.id === UID)?.plan_template_id === 'full-body');
    check('…and writes no weigh-in', s.weightHistory.length === 1 && !backend.writes.some((w) => w.table === 'weight_entries'));
    await app.close();
  }

  // ===== Forecast with four weeks of weigh-ins =========================================================
  async function forecastCase(label, perWeek, expect) {
    const weights = [];
    for (let i = 0; i <= 14; i++) {
      const back = 28 - i * 2;
      weights.push({ date: iso(back), weight_kg: Math.round((86 + (perWeek / 7) * (i * 2) + (i % 3 === 0 ? 0.3 : i % 3 === 1 ? -0.2 : 0)) * 10) / 10 });
    }
    const backend = createBackend().seed('profiles', profileRow({ weight_kg: weights.at(-1).weight_kg })).seed('weight_entries', weights);
    const app = await openApp({ backend, errors });
    await app.tab('Progress');
    const all = await app.page.locator('body').innerText();
    const at = all.indexOf('WEIGHT TREND\n'); // the card title is uppercased in CSS
    const text = all.slice(at, at + 600);
    check(label, at >= 0 && expect(text), JSON.stringify(text.slice(0, 300)));
    if (perWeek === -0.5) {
      await app.page.getByText('All weigh-ins', { exact: true }).scrollIntoViewIfNeeded();
      await shot(app.page, 'forecast');
    }
    await app.close();
  }
  await forecastCase('on course: date and weeks, in line with the plan', -0.5, (t) => /78\.0 kg by .+ — about \d+ weeks/.test(t) && t.includes('right in line with your plan'));
  await forecastCase('slower than planned says so', -0.2, (t) => t.includes('slower than the') && t.includes('your plan aims for'));
  await forecastCase('flat is called flat', 0, (t) => t.includes('Holding steady'));
  await forecastCase('gaining while aiming to lose says so', 0.4, (t) => t.includes('Heading away from 78.0 kg'));
}
