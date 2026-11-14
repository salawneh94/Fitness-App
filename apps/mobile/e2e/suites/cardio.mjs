// Cardio: logging a session with distance and pace, the calorie estimate, records, the weekly
// chart, miles, and cardio inside a guided workout.
import { createBackend, iso, openApp, profileRow } from '../lib/harness.mjs';

const DAY = new Date().toLocaleDateString('en-US', { weekday: 'short' });
const run = (id, date, durationMin, distanceKm) => ({ id, date, workout_name: 'Run', duration_min: durationMin, calories_burned: null, notes: null, exercise_logs: null,
  cardio: [{ activity: 'run', durationMin, distanceKm }] });
const running = { id: 'running', name: 'Steady-State Running', category: 'cardio', equipment: 'None', notes: '20-30 min moderate pace' };

export default async function ({ check, errors, shot }) {
  // ===== Logging a run ================================================================================
  {
    const backend = createBackend().seed('profiles', profileRow()) // 84 kg, metric
      .seed('workout_logs', run('last', iso(7), 30, 5))
      .seed('scheduled_workouts', { day: DAY, name: 'Conditioning', exercises: [running] });
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    const calories = page.getByLabel('Calories burned');
    await app.tab('Workouts');
    await page.getByText('Log cardio', { exact: true }).click();
    await app.settle();

    const saveRun = page.getByText('Save run', { exact: true });
    check('nothing to save without a duration', await saveRun.evaluate((el) => el.closest('[aria-disabled]')?.getAttribute('aria-disabled') === 'true'));
    await page.getByLabel('Duration in minutes').fill('33');
    check('time alone gives a calorie estimate from time', (await calories.inputValue()) === '453' && (await page.getByText(/Estimated from your weight and time/).count()) === 1, await calories.inputValue());
    await page.getByLabel('Distance in kilometres').fill('6');
    check('adding distance gives a pace', (await page.getByText('5:30 /km').count()) === 1 && (await page.getByText('average pace').count()) === 1);
    check('…and, on foot, a better estimate from distance: 1 kcal per kg per km', (await calories.inputValue()) === '504' && (await page.getByText(/Estimated from your weight and distance/).count()) === 1,
      await calories.inputValue());
    await shot(page, 'log');

    await page.getByRole('radio', { name: 'Cycle' }).click();
    check('a ride shows speed, not pace', (await page.getByText('10.9 km/h').count()) === 1 && (await page.getByText('average speed').count()) === 1);
    check('…and re-estimates for the activity', (await calories.inputValue()) === '314', await calories.inputValue());
    await page.getByRole('radio', { name: 'Other' }).click();
    check('"other" has no distance and no invented calories', (await page.getByLabel('Distance in kilometres').count()) === 0 && (await calories.inputValue()) === '');
    await page.getByRole('radio', { name: 'Run' }).click();
    await calories.fill('480');
    check('a typed figure replaces the estimate and its caveat', (await page.getByText(/Estimated from/).count()) === 0);
    await saveRun.click();
    await app.settle();

    const logged = (await state()).workoutLogs.find((w) => w.date === iso(0));
    check('the run is saved with its distance', logged?.workoutName === 'Run' && logged?.durationMin === 33 && logged?.caloriesBurned === 480
      && JSON.stringify(logged?.cardio) === JSON.stringify([{ activity: 'run', durationMin: 33, distanceKm: 6 }]), JSON.stringify(logged));
    check('…and synced', backend.find('workout_logs', (r) => r.date === iso(0))?.cardio?.[0]?.distanceKm === 6);
    const row = await page.locator('body').innerText();
    check('history shows distance and pace', /33 min · .+ · 480 kcal · 6 km · 5:30 \/km/.test(row), row.slice(row.indexOf('RECENT ACTIVITY'), row.indexOf('RECENT ACTIVITY') + 200));
    check('going further than ever before is a personal best', (await page.getByLabel('1 personal best: Run, Longest run: 6 km').count()) === 1);

    await app.tab('Progress');
    check('Progress sums the week', (await page.getByText('6 km · 33 min · 1 session').count()) === 1 && (await page.getByText('km per week').count()) === 1);
    await page.getByText('km per week').scrollIntoViewIfNeeded();
    await shot(page, 'week');

    // --- Cardio inside a guided workout -------------------------------------------------------------
    await app.tab('Workouts');
    await page.getByLabel(`${DAY}: Conditioning`, { exact: true }).click();
    await app.settle();
    await page.getByText('Start Workout', { exact: true }).click();
    await app.settle();
    check('a cardio exercise asks for minutes and distance, not weight and reps', (await page.getByLabel('Minutes').count()) === 1 && (await page.getByLabel('Distance in km').count()) === 1
      && (await page.getByPlaceholder('reps', { exact: true }).count()) === 0);
    check('…reminds you of the last one', (await page.getByText('Last time: 33 min · 6 km · 5:30 /km').count()) === 1);
    check('…and doesn’t print "NONE" for equipment', (await page.getByText('None', { exact: true }).count()) === 0);
    await page.getByLabel('Minutes').fill('20');
    await page.getByLabel('Distance in km').fill('4');
    await page.getByLabel('Log cardio').click();
    check('logging it shows time, distance and pace', (await page.getByLabel('Cardio logged').innerText()).includes('20 min · 4 km · 5:00 /km'));
    await page.getByText('Finish Workout', { exact: true }).click();
    await app.settle(300);
    check('the summary includes the distance', /\b4\s+km\b/.test(await page.locator('body').innerText()));
    check('a faster pace than ever is a record too', (await page.getByText('Fastest run: 5:00 /km').count()) === 1 && (await page.getByText('previous best 5:30 /km').count()) === 1);
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();
    const session = (await state()).workoutLogs.find((w) => w.workoutName === 'Conditioning');
    check('the session carries the cardio entry', JSON.stringify(session?.cardio) === JSON.stringify([{ activity: 'run', durationMin: 20, distanceKm: 4 }]), JSON.stringify(session?.cardio));
    await app.close();
  }

  // ===== Miles =========================================================================================
  {
    const backend = createBackend().seed('profiles', profileRow({ unit_system: 'imperial' }));
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    await app.tab('Workouts');
    await page.getByText('Log cardio', { exact: true }).click();
    await app.settle();
    await page.getByLabel('Duration in minutes').fill('30');
    await page.getByLabel('Distance in miles').fill('3.1');
    check('in imperial, distance is entered in miles and pace is per mile', (await page.getByText('Distance (mi)').count()) === 1 && (await page.getByText('9:41 /mi').count()) === 1);
    await page.getByText('Save run', { exact: true }).click();
    await app.settle();
    const km = (await state()).workoutLogs[0]?.cardio?.[0]?.distanceKm;
    check('…stored in kilometres, to the metre', km === 4.989, String(km));
    check('…and shown back in miles', /3\.1 mi · 9:41 \/mi/.test(await page.locator('body').innerText()));
    await app.close();
  }

  // ===== Who sees the cardio card ======================================================================
  {
    const lifter = await openApp({ backend: createBackend().seed('profiles', profileRow()), errors });
    await lifter.tab('Progress');
    check('no cardio logged and no endurance goal: no empty card in the way', (await lifter.page.getByText('Log a run, ride or swim').count()) === 0);
    await lifter.close();

    const runner = await openApp({ backend: createBackend().seed('profiles', profileRow({ goal: 'improve_endurance', target_weight_kg: null })), errors });
    await runner.tab('Progress');
    check('an endurance goal gets the card from day one, with a way in', (await runner.page.getByText('Log a run, ride or swim and your weekly distance builds up here.').count()) === 1);
    await runner.page.getByText('+ Log', { exact: true }).click();
    await runner.settle();
    check('…that opens the cardio log', (await runner.page.getByLabel('Duration in minutes').count()) === 1);
    await runner.close();
  }
}
