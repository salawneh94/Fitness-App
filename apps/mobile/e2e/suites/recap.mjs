// The weekly recap: last week told back at the start of this one, and any week on Progress.
import { EX, createBackend, datesFrom, openApp, profileRow, sessionRow } from '../lib/harness.mjs';

// Tuesday 6 October 2026. "Last week" is Mon 28 Sep – Sun 4 Oct.
const TUE = new Date(2026, 9, 6, 9, 0, 0);
const d = datesFrom(TUE);
const day = (isoDate) => d.iso(Math.round((new Date(2026, 9, 6) - new Date(`${isoDate}T00:00:00`)) / 864e5));
const food = (id, date) => ({ id, date, meal: 'dinner', name: 'Dinner', brand: null, quantity: 1, serving_label: 'plate', calories: 2000, protein_g: 100, carbs_g: 200, fat_g: 70,
  micros: null, source: 'manual', barcode: null, logged_at: `${date}T19:00:00Z` });
const run = (id, date, min, km) => ({ id, date, workout_name: 'Run', duration_min: min, calories_burned: null, notes: null, exercise_logs: null, cardio: [{ activity: 'run', durationMin: min, distanceKm: km }] });

const schedule = [
  { day: 'Mon', name: 'Full Body A', exercises: [EX.squat] },
  { day: 'Wed', name: 'Full Body B', exercises: [EX.deadlift] },
  { day: 'Sat', name: 'Full Body C', exercises: [EX.row] },
];
const seedWeek = (backend) => backend
  .seed('scheduled_workouts', schedule)
  .seed('workout_logs', [
    sessionRow('prev', '2026-09-21', 'Full Body A', { squat: [[80, 10]] }),
    run('prev-run', '2026-09-24', 30, 5),
    sessionRow('mon', '2026-09-28', 'Full Body A', { squat: [[82.5, 6]] }), // heavier than ever
    sessionRow('wed', '2026-09-30', 'Full Body B'),
    run('thu-run', '2026-10-01', 33, 6), // further than ever, on a rest day
  ])
  .seed('food_entries', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-02'].map((date, i) => food(`f${i}`, date)))
  .seed('weight_entries', [
    { date: '2026-09-22', weight_kg: 84.8 }, { date: '2026-09-25', weight_kg: 84.4 },
    { date: '2026-09-29', weight_kg: 84.2 }, { date: '2026-10-03', weight_kg: 83.8 },
  ]);

export default async function ({ check, errors, shot }) {
  // ===== The start of a new week ======================================================================
  {
    const backend = seedWeek(createBackend().seed('profiles', profileRow()));
    const app = await openApp({ backend, errors, now: TUE });
    const { page, state } = app;
    const text = await page.locator('body').innerText();
    check('early in the week, Overview opens with last week', (await page.getByText('Last week', { exact: true }).count()) === 1 && (await page.getByText('Sep 28 – Oct 4').count()) === 1);
    check('it leads with the best thing that happened', (await page.getByRole('heading', { name: '2 new personal bests' }).count()) === 1);
    check('sessions are counted against the plan, extras apart', text.includes('2 of 3 planned sessions done, plus 1 extra.'));
    check('the records are named', text.includes('New personal bests: Barbell Back Squat, Run.'));
    check('cardio is compared with the week before', text.includes('6 km of cardio over 1 session, up 1 km on the week before.'));
    check('food logging and the average against target', /Food logged on 4 of 7 days, averaging 2000 kcal against a \d+ target\./.test(text));
    check('protein, over the days that were fully logged', /Protein target hit on \d of 4 full days\./.test(text));
    check('weight, as weekly averages rather than two mornings', text.includes('Weight down 0.6 kg on the week before (weekly average).'));
    await page.getByText('Last week', { exact: true }).scrollIntoViewIfNeeded();
    await shot(page, 'overview');

    await page.getByText('Got it', { exact: true }).click();
    await app.settle(200);
    check('"Got it" puts it away', (await page.getByText('Last week', { exact: true }).count()) === 0 && (await state()).recapSeenWeek === '2026-09-28');
    await app.reload();
    check('…for good, not until the next launch', (await page.getByText('Last week', { exact: true }).count()) === 0);

    // --- Any week, on Progress ----------------------------------------------------------------------
    await app.tab('Progress');
    check('Progress keeps last week available', (await page.getByText('Last week', { exact: true }).count()) === 1 && (await page.getByRole('heading', { name: '2 new personal bests' }).count()) === 1);
    await page.getByLabel('Previous week').click();
    await app.settle(200);
    let body = await page.locator('body').innerText();
    check('paging back shows the week before, judged on its own', (await page.getByText('Sep 21 – Sep 27').count()) === 1 && body.includes('1 of 3 planned sessions done, plus 1 extra.')
      && body.includes('5 km of cardio over 1 session.'), body.slice(body.indexOf('WEEKLY RECAP'), body.indexOf('WEEKLY RECAP') + 300));
    check('…where a first-ever lift is a baseline, not a record', !body.slice(body.indexOf('WEEKLY RECAP'), body.indexOf('WEEKLY RECAP') + 300).includes('personal best'));
    await page.getByLabel('Next week').click();
    await page.getByLabel('Next week').click();
    await app.settle(200);
    check('paging forward reaches the week in progress', (await page.getByText('This week so far').count()) === 1 && (await page.getByText('Oct 5 – Oct 11').count()) === 1);
    check('…and stops there', await page.getByLabel('Next week').isDisabled());
    await app.close();
  }

  // ===== Later in the week ============================================================================
  {
    const backend = seedWeek(createBackend().seed('profiles', profileRow()));
    const app = await openApp({ backend, errors, now: new Date(2026, 9, 8, 9, 0, 0) }); // Thursday
    check('by Thursday, Overview has moved on', (await app.page.getByText('Last week', { exact: true }).count()) === 0);
    await app.close();
  }

  // ===== A week with nothing in it ====================================================================
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('scheduled_workouts', schedule);
    const app = await openApp({ backend, errors, now: TUE });
    check('an empty week isn’t pushed onto Overview', (await app.page.getByText('Last week', { exact: true }).count()) === 0);
    await app.tab('Progress');
    const body = await app.page.locator('body').innerText();
    check('on Progress it is called what it was, without a list of zeros', (await app.page.getByRole('heading', { name: 'A quiet week' }).count()) === 1
      && body.includes('Nothing was logged this week.') && !body.includes('0 of 3'));
    await app.close();
  }
}
