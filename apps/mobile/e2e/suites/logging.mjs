// Logging for past days, editing a logged food, and undoing deletes — against the stateful fake
// backend, so the sync side (delete, then restore under the same id) is real too.
import { chip, createBackend, daysAgo, iso, openApp, profileRow } from '../lib/harness.mjs';

const food = (id, date, meal, name, kcal, p) => ({ id, date, meal, name, brand: null, quantity: 1, serving_label: 'bowl', calories: kcal, protein_g: p,
  carbs_g: 50, fat_g: 8, micros: null, source: 'manual', barcode: null, logged_at: `${date}T08:00:00Z` });

export default async function ({ check, errors, shot }) {
  const TODAY = iso(0), YESTERDAY = iso(1), TWO_AGO = iso(2), THREE_AGO = iso(3);
  const DAY = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  const backend = createBackend()
    .seed('profiles', profileRow({ goal: 'maintain', target_weight_kg: null }))
    .seed('food_entries', [food('oats', TODAY, 'breakfast', 'Oats', 300, 10), food('pasta', TWO_AGO, 'dinner', 'Pasta', 700, 25)])
    .seed('workout_logs', { id: 'up', date: TODAY, workout_name: 'Upper', duration_min: 50, calories_burned: null, notes: null, exercise_logs: null, cardio: null })
    .seed('scheduled_workouts', { id: 's', day: DAY, name: 'Full Body A', exercises: [] });
  const app = await openApp({ backend, errors });
  const { page, state } = app;
  const onServer = (table, id) => backend.find(table, (r) => r.id === id);

  // --- Nutrition: fill in yesterday. ---------------------------------------------------------------
  await app.tab('Nutrition');
  check('opens on today, can’t go forward', (await page.getByRole('heading', { name: 'Today' }).count()) === 1 && (await page.getByLabel('Next day').isDisabled()));
  await page.getByLabel('Previous day').click();
  await app.settle(200);
  check('yesterday, with a way back', (await page.getByRole('heading', { name: 'Yesterday' }).count()) === 1 && (await page.getByText('Back to today').count()) === 1);
  check('yesterday shows yesterday — today’s oats aren’t here', (await page.getByText('Oats', { exact: true }).count()) === 0);
  await page.getByText('Add food').nth(2).click(); // dinner
  await app.settle();
  const yLabel = daysAgo(1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  check('the sheet says which day it’s adding to', (await page.getByText(`Add to dinner · ${yLabel}`).count()) === 1);
  check('"repeat" offers the day before the one being filled', (await page.getByText(`Repeat ${daysAgo(2).toLocaleDateString('en-US', { weekday: 'long' })}'s dinner`).count()) === 1);
  await page.getByPlaceholder(/Search foods/).fill('banana');
  await app.settle(300);
  await page.getByLabel('Choose Banana').click();
  await app.settle(300);
  await page.getByText('Add to log').click();
  await app.settle();
  const banana = (await state()).foodEntries.find((f) => f.name === 'Banana');
  check('logged to yesterday', banana?.date === YESTERDAY && banana?.meal === 'dinner', JSON.stringify(banana && { date: banana.date, meal: banana.meal }));
  check('yesterday’s view now shows it', (await page.getByText('Banana', { exact: true }).count()) === 1);
  await page.getByLabel(/^Add a glass/).click();
  await app.settle(200);
  const water = (await state()).waterHistory;
  check('water logged to yesterday, not today', water.some((w) => w.date === YESTERDAY && w.ml === 250) && !water.some((w) => w.date === TODAY), JSON.stringify(water));
  await page.getByText('Back to today').click();
  await app.settle(200);

  // --- Edit a logged food. -------------------------------------------------------------------------
  await page.getByLabel('Edit Oats').click();
  await app.settle();
  await shot(page, 'edit-food');
  await page.getByText('×2', { exact: true }).click();
  await page.getByRole('radio', { name: 'Lunch' }).click();
  check('edit preview doubles the calories', (await page.getByText('600', { exact: true }).count()) === 1);
  await page.getByText('Save changes').click();
  await app.settle();
  const oats = (await state()).foodEntries.find((f) => f.id === 'oats');
  check('servings and meal changed, same entry', oats?.quantity === 2 && oats?.meal === 'lunch', JSON.stringify(oats && { q: oats.quantity, m: oats.meal }));
  check('…and synced as an update of that row', onServer('food_entries', 'oats')?.quantity === 2 && onServer('food_entries', 'oats')?.meal === 'lunch');

  // --- Undo a delete. ------------------------------------------------------------------------------
  await page.getByLabel('Remove Oats').click();
  await app.settle(200);
  check('delete shows an undo toast', (await page.getByText('Removed Oats').count()) === 1);
  await app.settle(800); // let the delete reach the server first — the harder case
  const goneOnServer = !onServer('food_entries', 'oats');
  await page.getByLabel('Undo: Removed Oats').click();
  await app.settle(800);
  const restored = (await state()).foodEntries.find((f) => f.id === 'oats');
  check('undo brings it back, same id and edits', restored?.quantity === 2 && restored?.meal === 'lunch');
  check('…and recreates the server row the delete had removed', goneOnServer && onServer('food_entries', 'oats')?.quantity === 2, `deleted on server first: ${goneOnServer}`);
  await page.getByLabel('Remove Oats').click();
  await page.waitForTimeout(6000);
  check('without undo, the toast leaves and the delete stands', (await page.getByText('Removed Oats').count()) === 0
    && !(await state()).foodEntries.some((f) => f.id === 'oats') && !onServer('food_entries', 'oats'));

  // --- Workouts: undo, and logging for earlier days. ----------------------------------------------
  await app.tab('Workouts');
  await page.getByLabel('Delete workout log').first().click();
  await app.settle(200);
  await page.getByLabel('Undo: Removed Upper').click();
  await app.settle();
  check('workout delete is undoable', (await state()).workoutLogs.some((w) => w.id === 'up'));

  await page.getByText('Log cardio', { exact: true }).click();
  await app.settle();
  await page.getByRole('radio', { name: 'Yesterday' }).click();
  await page.getByLabel('Duration in minutes').fill('30');
  await page.getByText('Save run').click();
  await app.settle();
  check('cardio logged to yesterday', (await state()).workoutLogs.some((w) => w.workoutName === 'Run' && w.date === YESTERDAY));

  await page.getByLabel(new RegExp(`^${DAY}: Full Body A`)).click();
  await app.settle();
  await page.getByText('Log as done').click();
  await app.settle();
  await page.getByRole('radio', { name: chip(3) }).click();
  await page.getByText('Save', { exact: true }).last().click();
  await app.settle();
  check('a scheduled session logged as done three days ago', (await state()).workoutLogs.some((w) => w.workoutName === 'Full Body A' && w.date === THREE_AGO),
    JSON.stringify((await state()).workoutLogs.map((w) => [w.workoutName, w.date])));
  await app.close();
}
