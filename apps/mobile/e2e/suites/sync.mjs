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

  // ===== A write the server refuses ==================================================================
  // The queue sends writes in order and stops at the first failure. A write the server will never
  // accept (a constraint, a policy, a table that isn't there) used to sit at the head forever, with
  // everything logged after it stuck behind.
  {
    const backend = createBackend().seed('profiles', profileRow()).seed('weight_entries', { date: iso(3), weight_kg: 84 });
    backend.rejectWrite = (table, row) =>
      table === 'steps_entries' && row.steps === 4321 ? { status: 400, code: '23514', message: 'new row for relation "steps_entries" violates check constraint' } : null;
    const app = await openApp({ backend, errors });
    const { page } = app;
    const save = async () => {
      await page.getByText('Save', { exact: true }).first().click();
      await app.settle(600);
    };
    await page.getByLabel('Steps', { exact: true }).fill('4321');
    await save();
    // Steps cleared, so this Save queues the weight alone and the refused write stays at the head.
    await page.getByLabel('Steps', { exact: true }).fill('');
    await page.getByLabel('Weight', { exact: true }).fill('84.5');
    await save();
    check('a refused write doesn’t hold up the ones behind it', backend.find('weight_entries', (r) => r.date === iso(0))?.weight_kg === 84.5,
      `server has today's weight: ${Boolean(backend.find('weight_entries', (r) => r.date === iso(0)))}`);
    let q = await app.queue();
    check('…it is set aside, with the reason', q.pendingOps.length === 0 && q.rejectedOps?.length === 1 && /check constraint/.test(q.rejectedOps[0].error ?? ''), JSON.stringify({ pending: q.pendingOps.length, rejected: q.rejectedOps?.length }));
    check('…and isn’t hammered: one or two attempts, not a retry loop', backend.writes.filter((w) => w.table === 'steps_entries').length <= 2, `${backend.writes.filter((w) => w.table === 'steps_entries').length} attempts`);
    check('the user is told, not left thinking it synced', (await page.getByText(/1 change (wasn’t|was not) accepted/).count()) >= 1);

    await app.reload(); // full pull: the server has no such row, but it's the user's data — keep it
    check('the refused entry stays on the device across a restart', (await app.state()).stepsHistory.some((x) => x.date === iso(0) && x.steps === 4321));

    backend.rejectWrite = null; // whatever was wrong server-side is fixed
    await app.reload();
    q = await app.queue();
    check('once the server will take it, the next start sends it', backend.find('steps_entries', (r) => r.date === iso(0))?.steps === 4321 && !q.rejectedOps?.length,
      JSON.stringify({ onServer: Boolean(backend.find('steps_entries', (r) => r.date === iso(0))), rejected: q.rejectedOps?.length }));
    await app.close();
  }

  // ===== Two changes to the same row, the second while the first is in flight ========================
  {
    const backend = createBackend().seed('profiles', profileRow());
    const app = await openApp({ backend, errors });
    await app.tab('Nutrition');
    backend.writeDelayMs = 400;
    const glass = app.page.getByLabel(/^Add a glass/);
    await glass.click();
    await app.page.waitForTimeout(120); // the first write is on the wire
    await glass.click();
    await glass.click();
    await app.settle(1500);
    const local = (await app.state()).waterHistory.find((w) => w.date === iso(0))?.ml;
    check('the server ends on the last value, not the first one sent', local === 750 && backend.find('water_entries', (r) => r.date === iso(0))?.ml === 750,
      `phone ${local} ml, server ${backend.find('water_entries', (r) => r.date === iso(0))?.ml} ml`);
    check('…with nothing left waiting', (await app.queue()).pendingOps.length === 0);
    await app.close();
  }

  // ===== A server that is merely unwell ==============================================================
  {
    const backend = createBackend().seed('profiles', profileRow());
    backend.rejectWrite = (table) => (table === 'steps_entries' ? { status: 503, code: '', message: 'Service Unavailable' } : null);
    const app = await openApp({ backend, errors });
    await app.page.getByLabel('Steps', { exact: true }).fill('7000');
    await app.page.getByText('Save', { exact: true }).first().click();
    await app.settle(600);
    let q = await app.queue();
    check('a temporary failure is kept in the queue, not set aside', q.pendingOps.length === 1 && !q.rejectedOps?.length, JSON.stringify({ pending: q.pendingOps.length, rejected: q.rejectedOps?.length }));
    backend.rejectWrite = null;
    await app.reload();
    q = await app.queue();
    check('…and goes through when the server recovers', backend.find('steps_entries', (r) => r.steps === 7000) && q.pendingOps.length === 0);
    await app.close();
  }
}
