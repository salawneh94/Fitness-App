// The guided workout: what to put on the bar, personal bests, swapping an exercise, and deloading
// a lift that has stalled.
import { EX, createBackend, iso, openApp, profileRow, sessionRow } from '../lib/harness.mjs';

const DAY = new Date().toLocaleDateString('en-US', { weekday: 'short' });

/** Open today's scheduled session in the player. */
async function start(app, name = 'Strength') {
  await app.tab('Workouts');
  await app.page.getByLabel(`${DAY}: ${name}`, { exact: true }).click(); // exact: the Plans tab has a "…, today" cell
  await app.settle();
  await app.page.getByText('Start Workout', { exact: true }).click();
  await app.settle();
}
const fields = async (page) => [await page.getByPlaceholder('kg', { exact: true }).inputValue(), await page.getByPlaceholder('reps', { exact: true }).inputValue()].join(' × ');
async function logSet(page) {
  await page.getByLabel('Log set').click();
  await page.getByLabel('Skip rest').click();
  await page.waitForTimeout(150);
}

export default async function ({ check, errors, shot }) {
  // ===== Next load and personal bests =================================================================
  {
    const backend = createBackend()
      .seed('profiles', profileRow())
      .seed('scheduled_workouts', { day: DAY, name: 'Strength', exercises: [EX.squat, EX.bench, EX.row] })
      // Last week: squat topped the 6–10 range on every set; bench didn't.
      .seed('workout_logs', sessionRow('last', iso(7), 'Strength', { squat: [[80, 10], [80, 10], [80, 10], [80, 10]], bench: [[60, 8], [60, 7]] }));
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    await start(app);

    check('the player shows what was done last time', (await page.getByText('Last time: 80 kg × 10, 10, 10, 10').count()) === 1);
    check('every set at the top of the range earns the next weight', (await page.getByText('Try 82.5 kg × 6').count()) === 1
      && (await page.getByText('You hit the top of the range on every set').count()) === 1);
    check('…and the fields start on the suggestion', (await fields(page)) === '82.5 × 6', await fields(page));
    await shot(page, 'suggestion');
    check('before the first set, the exercise can be swapped', (await page.getByLabel('Swap Barbell Back Squat').count()) === 1);
    await logSet(page);
    check('a logged set is listed', (await page.getByText('82.5 kg × 6').count()) === 1);
    check('…after which swapping is no longer offered', (await page.getByLabel('Swap Barbell Back Squat').count()) === 0);

    await page.getByText('Next Exercise', { exact: true }).click();
    await app.settle(200);
    check('short of the top of the range, the weight holds and the target is one more rep', (await page.getByText('Aim for 8 reps at 60 kg').count()) === 1 && (await fields(page)) === '60 × 8');
    await page.getByPlaceholder('reps', { exact: true }).fill('9');
    await logSet(page);

    await page.getByText('Next Exercise', { exact: true }).click();
    await app.settle(200);
    check('an exercise never logged before has no suggestion, and empty fields', (await page.getByText(/^Last time/).count()) === 0 && (await fields(page)) === ' × ');
    await page.getByPlaceholder('kg', { exact: true }).fill('50');
    await page.getByPlaceholder('reps', { exact: true }).fill('10');
    await logSet(page);
    await page.getByText('Finish Workout', { exact: true }).click();
    await app.settle(300);

    check('the summary counts the sets', /\b3\s+sets logged/.test(await page.locator('body').innerText()));
    check('a weight never lifted before is a personal best', (await page.getByText('Heaviest ever: 82.5 kg × 6').count()) === 1 && (await page.getByText('previous best 80 kg').count()) === 1);
    check('more reps at the same weight is one too, by estimated 1RM', (await page.getByText('Best set: 60 kg × 9').count()) === 1 && (await page.getByText('estimated 1RM 78 kg, up from 76 kg').count()) === 1);
    check('the first time an exercise is logged is a baseline, not a record', (await page.getByText('2 new personal bests').count()) === 1 && (await page.getByText(/Barbell Row/).count()) === 0);
    await shot(page, 'records');
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();

    const log = (await state()).workoutLogs.find((w) => w.date === iso(0));
    check('the session is saved with every set', log?.exerciseLogs?.length === 3 && log.exerciseLogs[0].sets[0].weightKg === 82.5 && log.exerciseLogs[1].sets[0].reps === 9,
      JSON.stringify(log?.exerciseLogs?.map((e) => [e.exerciseName, e.sets])));
    check('…and reaches the server', backend.find('workout_logs', (r) => r.date === iso(0))?.exercise_logs?.length === 3);
    await page.getByLabel('Close').click().catch(() => {});
    await app.settle(200);
    check('history marks the session with its personal bests',
      (await page.getByLabel('2 personal bests: Barbell Back Squat, Heaviest ever: 82.5 kg × 6; Barbell Bench Press, Best set: 60 kg × 9').count()) === 1);
    check('…newest first, with the set count', (await page.getByText(/3 sets logged/).count()) === 1 && (await page.getByText(/6 sets logged/).count()) === 1);
    await app.close();
  }

  // ===== Swapping an exercise =========================================================================
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('scheduled_workouts', { id: 'sched', day: DAY, name: 'Strength', exercises: [EX.squat, EX.bench] });
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    const scheduleIds = async () => (await state()).scheduledWorkouts[0].exercises.map((e) => e.id).join(',');
    await start(app);

    await page.getByLabel('Swap Barbell Back Squat').click();
    await app.settle(300);
    const sheet = await page.locator('body').innerText();
    const at = (text) => sheet.indexOf(text);
    check('swap options lead with the same movement', at('CLOSEST MATCH — SAME MOVEMENT') >= 0 && at('Goblet Squat') > at('CLOSEST MATCH — SAME MOVEMENT') && at('Goblet Squat') < at('ALSO WORKS YOUR LEGS'),
      JSON.stringify(sheet.slice(at('Swap Barbell Back Squat'), at('Swap Barbell Back Squat') + 400)));
    check('…with different equipment first — the usual reason to swap is that the bar is taken', at('Goblet Squat') < at('Front Squat') && at('Leg Press') < at('Front Squat'));
    check('a calf raise is not offered as a squat', at('Standing Calf Raise') === -1 || at('Standing Calf Raise') > at('ALSO WORKS YOUR LEGS'));
    await shot(page, 'swap');
    await page.getByText('Goblet Squat', { exact: true }).click();
    await page.getByText('Just today', { exact: true }).click();
    await app.settle(300);
    check('"just today" changes the session', (await page.getByText('Goblet Squat', { exact: true }).count()) === 1 && (await page.getByText('Barbell Back Squat').count()) === 0);
    check('…and takes the new exercise’s own rep range', (await page.getByText(/^4 sets × /).innerText()) !== '4 sets × 6-10', await page.getByText(/^4 sets × /).innerText().catch(() => 'not found'));
    check('…without touching the plan', (await scheduleIds()) === 'squat,bench-press');
    await page.getByPlaceholder('kg', { exact: true }).fill('20');
    await page.getByPlaceholder('reps', { exact: true }).fill('10');
    await logSet(page);
    await page.getByText('Next Exercise', { exact: true }).click();
    await app.settle(200);

    await page.getByLabel('Swap Barbell Bench Press').click();
    await app.settle(300);
    await page.getByText('Incline Dumbbell Press', { exact: true }).click();
    await page.getByText('Swap in my plan too', { exact: true }).click();
    await app.settle(600);
    check('"in my plan too" also rewrites the schedule', (await scheduleIds()) === 'squat,incline-db-press', await scheduleIds());
    check('…on the server', backend.find('scheduled_workouts', (r) => r.day === DAY)?.exercises?.map((e) => e.id).join(',') === 'squat,incline-db-press');
    await page.getByPlaceholder('kg', { exact: true }).fill('22');
    await page.getByPlaceholder('reps', { exact: true }).fill('10');
    await logSet(page);
    await page.getByText('Finish Workout', { exact: true }).click();
    await app.settle(300);
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();
    const log = (await state()).workoutLogs[0];
    check('the session is logged under what was actually done', log?.exerciseLogs?.map((e) => e.exerciseName).join(', ') === 'Goblet Squat, Incline Dumbbell Press',
      log?.exerciseLogs?.map((e) => e.exerciseName).join(', '));
    await app.close();
  }

  // ===== A stalled lift ===============================================================================
  {
    const stuck = (id, back) => sessionRow(id, iso(back), 'Strength', { bench: [[60, 8], [60, 7]] });
    const backend = createBackend().seed('profiles', profileRow())
      .seed('scheduled_workouts', { day: DAY, name: 'Strength', exercises: [EX.bench] })
      .seed('workout_logs', [stuck('a', 21), stuck('b', 14), stuck('c', 7)]);
    const app = await openApp({ backend, errors });
    const { page, state } = app;
    await start(app);
    check('three sessions stuck at one weight is called out', (await page.getByText('3 sessions at this weight — a lighter session often breaks it').count()) === 1);
    await page.getByText('Deload to 55 kg instead', { exact: true }).click();
    await app.settle(200);
    check('choosing the deload changes the advice', (await page.getByText('Deload: 55 kg × 10').count()) === 1);
    check('…and the fields with it', (await fields(page)) === '55 × 10', await fields(page));
    const plan = (await state()).deloads;
    check('the deload is remembered', plan.length === 1 && plan[0].exerciseId === 'bench-press' && plan[0].stalledKg === 60 && plan[0].deloadKg === 55, JSON.stringify(plan));

    await page.getByLabel('Exit workout').click();
    await app.settle(200);
    await app.page.getByLabel('Close').click().catch(() => {});
    await app.tab('Plans');
    check('walking away without lifting keeps it planned, where it can be seen', (await page.getByText('Planned deloads').count()) === 1 && (await page.getByText('60 kg → 55 kg next session').count()) === 1);

    await start(app);
    check('next time, the player opens on the deload', (await page.getByText('Deload: 55 kg × 10').count()) === 1 && (await fields(page)) === '55 × 10');
    await logSet(page);
    await page.getByText('Finish Workout', { exact: true }).click();
    await app.settle(300);
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();
    await page.getByLabel('Close').click().catch(() => {});
    await app.tab('Plans');
    check('once the lighter session is done, the plan is spent', (await page.getByText('Planned deloads').count()) === 0);
    await start(app);
    check('…and the next session builds back up from it', (await page.getByText('Try 57.5 kg × 6').count()) === 1, await page.getByText(/^(Try|Aim|Deload|Hold)/).innerText().catch(() => 'none'));
    await app.close();
  }
}
