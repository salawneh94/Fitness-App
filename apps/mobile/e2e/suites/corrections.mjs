// Typo guards on the quick log, and correcting / deleting weigh-ins from their history.
import { UID, createBackend, daysAgo, iso, openApp, profileRow } from '../lib/harness.mjs';

const longDay = (back) => daysAgo(back).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default async function ({ check, errors, shot }) {
  // ===== Quick log guards ==============================================================================
  {
    const backend = createBackend().seed('profiles', profileRow({ weight_kg: 85.2 })).seed('weight_entries', { date: iso(2), weight_kg: 85.2 });
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    const weight = page.getByLabel('Weight', { exact: true });
    const save = async () => {
      await page.getByText(/^Save( anyway)?$/).first().click();
      await app.settle(300);
    };

    await weight.fill('850');
    await save();
    check('an impossible weight is refused, with the range', (await page.getByText('Weight should be between 30 and 300 kg.').count()) === 1
      && !(await state()).weightHistory.some((x) => x.date === iso(0)));

    await weight.fill('58');
    check('typing again clears the message', (await page.getByText(/Weight should be/).count()) === 0);
    await save();
    check('a big jump is questioned, against the nearest reading', (await page.getByText(/That’s 27\.2 kg less than on .+ \(85\.2 kg\)/).count()) === 1);
    check('…and the button offers to save anyway', (await page.getByText('Save anyway', { exact: true }).count()) === 1);
    check('…without saving yet', !(await state()).weightHistory.some((x) => x.date === iso(0)));
    await shot(page, 'guard');

    await weight.fill('85.6');
    check('changing the weight drops the "anyway"', (await page.getByText('Save anyway', { exact: true }).count()) === 0);
    await weight.fill('58');
    await save();
    await save();
    let s = await state();
    check('confirmed, the unusual weight is saved', s.weightHistory.some((x) => x.date === iso(0) && x.weightKg === 58) && s.profile.weightKg === 58);

    await page.getByLabel('Steps', { exact: true }).fill('250000');
    await save();
    check('impossible steps are refused', (await page.getByText('Steps should be a whole number up to 100,000.').count()) === 1 && !(await state()).stepsHistory.length);
    await page.getByLabel('Steps', { exact: true }).fill('9000');
    await save();
    s = await state();
    check('re-saving the day with steps doesn’t re-question the confirmed weight', s.stepsHistory.some((x) => x.date === iso(0) && x.steps === 9000)
      && (await page.getByText(/That’s/).count()) === 0);
    await app.close();
  }

  // ===== Weigh-in history ==============================================================================
  {
    // The newest reading is a typo, so it's also "current weight" — the case this exists for.
    const backend = createBackend().seed('profiles', profileRow({ weight_kg: 850 }))
      .seed('weight_entries', [{ date: iso(10), weight_kg: 85.4 }, { date: iso(6), weight_kg: 85.0 }, { date: iso(2), weight_kg: 850 }]);
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    const onServer = (back) => backend.find('weight_entries', (r) => r.date === iso(back));
    check('(setup) the typo is the current weight', (await state()).profile.weightKg === 850);
    await app.tab('Progress');
    await page.getByLabel('All weigh-ins').click();
    await app.settle();
    const listed = await page.getByLabel(/^Edit weigh-in on /).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    check('every weigh-in, newest first', JSON.stringify(listed) === JSON.stringify([2, 6, 10].map((b) => `Edit weigh-in on ${longDay(b)}`)), JSON.stringify(listed));
    check('with the change since the one before', (await page.getByText('+765.0', { exact: true }).count()) === 1 && (await page.getByText('−0.4', { exact: true }).count()) === 1);
    await shot(page, 'weigh-ins');

    await page.getByLabel(`Edit weigh-in on ${longDay(2)}`).click();
    const field = page.getByLabel(`Weight on ${longDay(2)}`);
    check('editing starts from the stored value', (await field.inputValue()) === '850');
    await field.fill('85');
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();
    let s = await state();
    check('the typo is corrected in place', s.weightHistory.find((x) => x.date === iso(2))?.weightKg === 85 && s.weightHistory.length === 3);
    check('…the current weight follows', s.profile.weightKg === 85);
    check('…and both reach the server', onServer(2)?.weight_kg === 85 && backend.find('profiles', (r) => r.id === UID)?.weight_kg === 85);

    await page.getByLabel(`Delete weigh-in on ${longDay(6)}`).click();
    await app.settle(200);
    check('deleting offers undo', (await page.getByText(/^Deleted 85\.0 kg on /).count()) === 1);
    await app.settle(800);
    const goneOnServer = !onServer(6);
    await page.getByLabel(/^Undo: Deleted 85\.0 kg/).click();
    await app.settle(800);
    check('undo puts it back, here and on the server', (await state()).weightHistory.some((x) => x.date === iso(6) && x.weightKg === 85) && goneOnServer && onServer(6)?.weight_kg === 85,
      `deleted on server first: ${goneOnServer}`);

    await page.getByLabel(`Delete weigh-in on ${longDay(2)}`).click();
    await page.waitForTimeout(6000); // past the toast's five seconds
    s = await state();
    check('deleting the newest falls back to the next-newest as current weight', !s.weightHistory.some((x) => x.date === iso(2)) && s.profile.weightKg === 85, `profile.weightKg=${s.profile.weightKg}`);
    check('…and the delete stands on the server once the toast has gone', !onServer(2) && backend.find('profiles', (r) => r.id === UID)?.weight_kg === 85);
    check('the other weigh-ins were left alone on the server', backend.rows('weight_entries').length === 2);
    await app.close();
  }
}
