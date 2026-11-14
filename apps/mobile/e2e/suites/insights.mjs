// The coach layer: what the app notices, and the one-tap action next to each observation.
import { EX, createBackend, iso, openApp, profileRow, sessionRow } from '../lib/harness.mjs';

const meal = (id, date, name, kcal, protein) => ({ id, date, meal: 'dinner', name, brand: null, quantity: 1, serving_label: 'plate', calories: kcal, protein_g: protein,
  carbs_g: 60, fat_g: 20, micros: null, source: 'manual', barcode: null, logged_at: `${date}T19:00:00Z` });

export default async function ({ check, errors, shot }) {
  // ===== Nothing to say ===============================================================================
  {
    const app = await openApp({ backend: createBackend().seed('profiles', profileRow()), errors });
    check('with no history, the card stays away rather than saying "no insights yet"', (await app.page.getByText('What we noticed').count()) === 0);
    await app.close();
  }

  // ===== A stalled lift, and deloading it from the card ===============================================
  {
    const week = (id, back, squatKg) => sessionRow(id, iso(back), 'Strength', { bench: [[60, 8], [60, 7]], squat: [[squatKg, 8]] });
    const backend = createBackend().seed('profiles', profileRow()).seed('workout_logs', [week('a', 21, 70), week('b', 14, 75), week('c', 7, 80)]);
    const app = await openApp({ backend, errors });
    const { page, state } = app;

    check('three sessions at one top weight is noticed, with the evidence', (await page.getByText('Barbell Bench Press has stopped moving').count()) === 1
      && (await page.getByText(/Same top weight of 60 kg for 3 sessions\. Dropping to 55 kg for a session/).count()) === 1);
    check('a lift that is climbing gets the one "win"', (await page.getByText('Barbell Back Squat is up 10 kg').count()) === 1);
    check('…and the stalled one isn’t congratulated alongside it', (await page.getByText(/Bench Press is up/).count()) === 0);
    await page.getByText('Deload to 55 kg', { exact: true }).click();
    await app.settle(200);
    check('one tap plans the deload', (await page.getByText('Planned: 55 kg next session').count()) === 1 && (await page.getByText('Deload to 55 kg', { exact: true }).count()) === 0);
    check('…and it is remembered', JSON.stringify((await state()).deloads.map((d) => [d.exerciseId, d.stalledKg, d.deloadKg])) === JSON.stringify([['bench-press', 60, 55]]));
    await shot(page, 'deload-planned');

    await app.tab('Plans');
    check('the plan shows up on the Plans tab', (await page.getByText('60 kg → 55 kg next session').count()) === 1);
    await page.getByLabel('Cancel the deload on Barbell Bench Press').click();
    await app.settle(200);
    check('…where it can be cancelled', (await page.getByText('Planned deloads').count()) === 0 && (await state()).deloads.length === 0);
    await app.tab('Overview');
    check('cancelling puts the offer back', (await page.getByText('Deload to 55 kg', { exact: true }).count()) === 1);

    await page.getByLabel('Not now: Barbell Bench Press has stopped moving').click();
    await app.settle(200);
    check('"not now" hides that observation', (await page.getByText('Barbell Bench Press has stopped moving').count()) === 0);
    check('…keyed to this plateau, for a week', Object.keys((await state()).insightSnoozes).join() === 'lift_stalled:bench-press:60' && (await state()).insightSnoozes['lift_stalled:bench-press:60'] === iso(-7),
      JSON.stringify((await state()).insightSnoozes));
    await app.reload();
    check('…and it stays hidden after a restart', (await page.getByText('Barbell Bench Press has stopped moving').count()) === 0 && (await page.getByText('Barbell Back Squat is up 10 kg').count()) === 1);
    await app.close();
  }

  // ===== Protein short → high-protein foods ===========================================================
  {
    const days = Array.from({ length: 12 }, (_, i) => [meal(`p${i}`, iso(i + 1), 'Pasta bake', 1500, 35), meal(`c${i}`, iso(i + 1), 'Chicken & rice', 500, 45)]).flat();
    const backend = createBackend().seed('profiles', profileRow()).seed('food_entries', days);
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    check('protein missed on most logged days is noticed, with the count', (await page.getByText('Protein is the gap in your nutrition').count()) === 1
      && (await page.getByText(/You hit your \d+g target on 0 of the last 12 logged days/).count()) === 1);
    await page.getByText('Show high-protein foods', { exact: true }).click();
    await app.settle();
    check('the action opens a list of high-protein foods', (await page.getByText('High-protein picks').count()) === 1);
    check('…your own qualifying foods first', (await page.getByLabel('Log Chicken & rice').count()) === 1 && (await page.getByLabel('Log Chicken & rice').innerText()).includes('45 g protein'));
    // The sheet also lists recent foods further down, so look only inside the picks section.
    const sheet = await page.locator('body').innerText();
    const picks = sheet.slice(sheet.indexOf('HIGH-PROTEIN PICKS'), sheet.indexOf('Chicken breast, cooked'));
    check('…leaving out the ones that are mostly calories', sheet.indexOf('HIGH-PROTEIN PICKS') >= 0 && picks.includes('Chicken & rice') && !picks.includes('Pasta bake'), JSON.stringify(picks.slice(0, 300)));
    check('…which are still there in the ordinary recent list', sheet.slice(sheet.indexOf('Chicken breast, cooked')).includes('Pasta bake'));
    check('…then staples', (await page.getByLabel('Choose Chicken breast, cooked').count()) === 1);
    await shot(page, 'protein-picks');
    await page.getByLabel('Log Chicken & rice').click();
    await app.settle();
    check('one tap logs it today', (await state()).foodEntries.some((f) => f.name === 'Chicken & rice' && f.date === iso(0)));
    await app.close();
  }

  // ===== No cardio, for an endurance goal =============================================================
  {
    const backend = createBackend().seed('profiles', profileRow({ goal: 'improve_endurance', target_weight_kg: null })).seed('weight_entries', { date: iso(20), weight_kg: 84 });
    const app = await openApp({ backend, errors });
    const { page } = app;
    check('two weeks without cardio is raised for an endurance goal', (await page.getByText('No cardio logged in two weeks').count()) === 1
      && (await page.getByText(/Nothing over the last two weeks, against the WHO baseline of 150/).count()) === 1);
    await page.getByText('Log cardio', { exact: true }).click();
    await app.settle();
    await page.getByLabel('Duration in minutes').fill('40');
    await page.getByText('Save run', { exact: true }).click();
    await app.settle();
    check('logging some updates the observation to what’s still missing', (await page.getByText('Cardio is under the weekly baseline').count()) === 1 && (await page.getByText(/About 20 minutes a week/).count()) === 1);
    await app.close();
  }
  {
    // A brand-new account has no cardio because it's new, not because of a habit.
    const app = await openApp({ backend: createBackend().seed('profiles', profileRow({ goal: 'improve_endurance', target_weight_kg: null })), errors });
    check('a new account isn’t told off for it', (await app.page.getByText('No cardio logged in two weeks').count()) === 0);
    await app.close();
  }

  // ===== A finished block → what's next ===============================================================
  {
    const started = iso(63); // nine weeks ago
    const sessions = Array.from({ length: 12 }, (_, i) => sessionRow(`s${i}`, iso(60 - i * 5), 'Full Body A'));
    const backend = createBackend().seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: started }))
      .seed('scheduled_workouts', { day: 'Mon', name: 'Full Body A', exercises: [EX.squat] }).seed('workout_logs', sessions);
    const app = await openApp({ backend, errors });
    const { page } = app;
    check('finishing a plan’s weeks, having actually trained them, is noticed', (await page.getByText("You've finished 8 weeks of Full Body 3-Day").count()) === 1
      && (await page.getByText(/12 sessions since you started it/).count()) === 1);
    await page.getByText('Choose what’s next', { exact: true }).click();
    await app.settle();
    check('the action goes to the plans', (await page.getByText('Block complete').count()) === 1 && (await page.getByText('Browse plans').count()) === 1);
    await app.close();
  }
  {
    const backend = createBackend().seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: iso(63) }))
      .seed('scheduled_workouts', { day: 'Mon', name: 'Full Body A', exercises: [EX.squat] })
      .seed('workout_logs', Array.from({ length: 4 }, (_, i) => sessionRow(`s${i}`, iso(60 - i * 5), 'Full Body A')));
    const app = await openApp({ backend, errors });
    check('…but four sessions in nine weeks is not "finished"', (await app.page.getByText(/You've finished/).count()) === 0);
    await app.close();
  }

  // ===== Safety outranks everything ===================================================================
  {
    // Dropping 1.5 kg a week, with a stalled lift as well: the warning leads.
    const weights = Array.from({ length: 15 }, (_, i) => ({ date: iso(28 - i * 2), weight_kg: Math.round((90 - (1.5 / 7) * i * 2) * 10) / 10 }));
    const stuck = (id, back) => sessionRow(id, iso(back), 'Strength', { bench: [[60, 8]] });
    const backend = createBackend().seed('profiles', profileRow({ weight_kg: 84 })).seed('weight_entries', weights).seed('workout_logs', [stuck('a', 21), stuck('b', 14), stuck('c', 7)]);
    const app = await openApp({ backend, errors });
    const text = await app.page.locator('body').innerText();
    const warn = text.indexOf("You're losing weight faster than is sustainable");
    check('losing weight too fast is a warning, with the rate', warn >= 0 && /Down about 1\.50 kg a week over the last 28 days/.test(text), text.slice(Math.max(0, warn), warn + 160));
    check('…placed above the stalled lift', warn >= 0 && warn < text.indexOf('Barbell Bench Press has stopped moving'));
    await app.close();
  }
}
