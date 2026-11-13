// The Plans tab: applying a plan, seeing where the week stands, making up a missed session, and
// reaching the end of a block. The clock is pinned so "today" is always the same Thursday.
import { EX, UID, createBackend, datesFrom, openApp, playWorkout, profileRow, sessionRow } from '../lib/harness.mjs';

// Thursday 8 October 2026. That week runs Mon 5 – Sun 11; a three-day plan lands on Mon, Wed, Sat.
const NOW = new Date(2026, 9, 8, 10, 0, 0);
const d = datesFrom(NOW);
const MON = d.iso(3), WED = d.iso(1), THU = d.iso(0);

const fullBody = [
  { day: 'Mon', name: 'Full Body A', exercises: [EX.squat, EX.bench] },
  { day: 'Wed', name: 'Full Body B', exercises: [EX.deadlift, EX.ohp] },
  { day: 'Sat', name: 'Full Body C', exercises: [EX.row] },
];
const cells = (page) => page.locator('[aria-label*=": "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter((l) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun): /.test(l)));

export default async function ({ check, errors, shot }) {
  // ===== Choosing a plan ==============================================================================
  {
    const backend = createBackend().seed('profiles', profileRow());
    const app = await openApp({ backend, errors, now: NOW });
    const { page, state } = app;
    await app.tab('Plans');
    check('with no schedule, the tab is a catalogue with a recommendation', (await page.getByText('Workout plan ideas').count()) === 1
      && (await page.getByText('Recommended for you: Full Body 3-Day').count()) === 1);
    check('…explained in terms of what the user said at sign-up', (await page.getByText(/fits your 3 day\/week availability exactly/).count()) === 1);
    await page.getByText('Apply to weekly schedule', { exact: true }).click();
    await app.settle();
    let s = await state();
    check('applying lays the plan out across the week', JSON.stringify(s.scheduledWorkouts.map((w) => `${w.day} ${w.name}`).sort()) === JSON.stringify(['Mon Full Body A', 'Sat Full Body C', 'Wed Full Body B']),
      JSON.stringify(s.scheduledWorkouts.map((w) => `${w.day} ${w.name}`)));
    check('…and starts counting its weeks from today', s.profile.activePlan?.templateId === 'full-body' && s.profile.activePlan?.startedOn === THU, JSON.stringify(s.profile.activePlan));
    check('the tab now shows the plan being followed', (await page.getByText('Your plan').count()) === 1 && (await page.getByText('Week 1 of 8').count()) === 1);
    const profile = backend.find('profiles', (r) => r.id === UID);
    check('the plan is saved to the account', profile?.plan_template_id === 'full-body' && profile?.plan_started_on === THU && backend.rows('scheduled_workouts').length === 3);
    await shot(page, 'applied');

    // Switching takes a second tap, because it resets the schedule and the week count.
    await page.getByText('Push / Pull / Legs', { exact: true }).click();
    await page.getByText('Use this plan', { exact: true }).click();
    check('switching plans asks first, naming what is replaced', (await page.getByText('This replaces your current Full Body 3-Day and starts Push / Pull / Legs from week 1.').count()) === 1
      && (await state()).profile.activePlan.templateId === 'full-body');
    await page.getByText('Keep current', { exact: true }).click();
    check('…and can be backed out of', (await page.getByText('Switch to Push / Pull / Legs').count()) === 0 && (await state()).scheduledWorkouts.length === 3);
    await page.getByText('Use this plan', { exact: true }).click();
    await page.getByText('Switch to Push / Pull / Legs', { exact: true }).click();
    await app.settle();
    s = await state();
    check('confirmed, the new plan replaces the old schedule', s.profile.activePlan.templateId === 'ppl' && s.scheduledWorkouts.length === 6 && !s.scheduledWorkouts.some((w) => w.name.startsWith('Full Body')));
    const days = backend.rows('scheduled_workouts').map((r) => r.day).sort();
    check('…on the server too: one row per weekday, none left over from the old plan', days.length === 6 && new Set(days).size === 6 && !backend.rows('scheduled_workouts').some((r) => r.name.startsWith('Full Body')),
      JSON.stringify(backend.rows('scheduled_workouts').map((r) => `${r.day} ${r.name}`)));
    check('…with no write refused along the way', !backend.writes.some((w) => w.refused));
    await app.close();
  }

  // ===== The week so far, and making up a miss ========================================================
  {
    const backend = createBackend()
      .seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: d.iso(10) })) // Mon 28 Sep → week 2
      .seed('scheduled_workouts', fullBody)
      .seed('workout_logs', sessionRow('a', MON, 'Full Body A', { squat: [[80, 8]] }));
    const app = await openApp({ backend, errors, now: NOW });
    const { page, state } = app;
    await app.tab('Plans');
    check('the plan is named, with the week it is on', (await page.getByText('Full Body 3-Day', { exact: true }).first().count()) === 1 && (await page.getByText('Week 2 of 8').count()) === 1);
    let week = await cells(page);
    check('Monday’s session shows as done', week.includes('Mon: Full Body A, done'), JSON.stringify(week));
    check('Wednesday’s, not logged, shows as missed', week.includes('Wed: Full Body B, missed'));
    check('Saturday’s is still to come', week.includes('Sat: Full Body C, coming up'));
    check('the count matches', (await page.getByText('1 of 3').count()) === 1);
    check('what’s next is named with its day', (await page.getByText('Next · Saturday').count()) === 1);
    check('today is free, so the miss can be made up now', (await page.getByLabel('Make up Full Body B today').count()) === 1 && (await page.getByText('Missed Wednesday').count()) === 1);
    await shot(page, 'missed');

    await page.getByLabel('Make up Full Body B today').click();
    await app.settle();
    check('making it up opens that session’s workout', (await page.getByText('Conventional Deadlift').count()) === 1);
    await playWorkout(app, [[[100, 5]], []]);
    check('finishing shows the summary', (await page.getByText('Nice work on Full Body B!').count()) === 1);
    await page.getByText('Save', { exact: true }).last().click();
    await app.settle();
    const made = (await state()).workoutLogs.find((w) => w.workoutName === 'Full Body B');
    check('it is logged today, under the missed session’s name', made?.date === THU && made?.exerciseLogs?.[0]?.sets?.[0]?.weightKg === 100, JSON.stringify(made && { date: made.date }));
    week = await cells(page);
    check('Wednesday now reads made up, and says when', week.includes('Wed: Full Body B, made up on Thursday'), JSON.stringify(week));
    check('the week count moves to 2 of 3', (await page.getByText('2 of 3').count()) === 1);
    check('…and the offer is gone', (await page.getByLabel('Make up Full Body B today').count()) === 0 && (await page.getByText(/^Missed/).count()) === 0);
    check('the session reached the server', backend.find('workout_logs', (r) => r.workout_name === 'Full Body B')?.date === THU);
    await shot(page, 'made-up');
    await app.close();
  }

  // ===== A miss on a day that already has a session ===================================================
  {
    // Same week, but Thursday has its own session: doubling up isn't offered.
    const backend = createBackend()
      .seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: d.iso(10) }))
      .seed('scheduled_workouts', [...fullBody.slice(0, 2), { day: 'Thu', name: 'Full Body C', exercises: [EX.row] }]);
    const app = await openApp({ backend, errors, now: NOW });
    await app.tab('Plans');
    const { page } = app;
    check('with a session already due today, no make-up button', (await page.getByText('Make it up today').count()) === 0 && (await page.getByText('Missed this week').count()) === 1);
    check('…both misses are listed', (await page.getByText('Monday · Full Body A').count()) === 1 && (await page.getByText('Wednesday · Full Body B').count()) === 1);
    check('…with the actual next free day', (await page.getByText(/Today has Full Body C — Friday is free to make one up\./).count()) === 1);
    await app.close();
  }

  // ===== An edited schedule, and the end of a block ===================================================
  {
    const backend = createBackend()
      .seed('profiles', profileRow({ plan_template_id: 'full-body', plan_started_on: d.iso(3 + 7 * 8) })) // nine Mondays ago
      .seed('scheduled_workouts', [fullBody[0], { ...fullBody[1], name: 'Deadlift day' }, fullBody[2]]);
    const app = await openApp({ backend, errors, now: NOW });
    await app.tab('Plans');
    const { page } = app;
    check('a renamed session makes it "based on" the plan, not the plan', (await page.getByText(/Based on Full Body 3-Day · 3 sessions a week/).count()) === 1);
    check('past its eight weeks, the block is marked complete', (await page.getByText('Block complete').count()) === 1 && (await page.getByText(/You're past the 8 weeks this plan is built for/).count()) === 1);
    await page.getByText('Full Body 3-Day', { exact: true }).last().click();
    check('the current plan offers a restart rather than "use"', (await page.getByText('Restart this plan', { exact: true }).count()) === 1);
    await page.getByText('Restart this plan', { exact: true }).click();
    await page.getByText('Restart plan', { exact: true }).click();
    await app.settle();
    const s = await app.state();
    check('restarting goes back to week 1 and the plan’s own sessions', s.profile.activePlan.startedOn === THU && (await page.getByText('Week 1 of 8').count()) === 1
      && !s.scheduledWorkouts.some((w) => w.name === 'Deadlift day'));
    await app.close();
  }
}
