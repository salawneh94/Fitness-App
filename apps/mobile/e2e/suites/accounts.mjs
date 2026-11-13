// Who sees what: the first sync on a new phone, a first sync that fails, and two people taking
// turns on one phone.
import { OTHER_UID, UID, createBackend, iso, openApp, profileRow } from '../lib/harness.mjs';

const SAM = { id: UID, email: 'sam@example.com', password: 'sam-pass-1' };
const DANA = { id: OTHER_UID, email: 'dana@example.com', password: 'dana-pass-1' };
const onboarding = (page) => page.getByPlaceholder('Jane Doe').count();

export default async function ({ check, errors, shot }) {
  // ===== A returning user on a new phone, slow connection ===========================================
  // With nothing on the device yet the app has no profile, and "no profile" used to mean "new user":
  // onboarding appeared while the real profile was still downloading, and finishing it overwrote the
  // real one on the server.
  {
    const backend = createBackend({ users: [SAM] }).seed('profiles', profileRow());
    backend.readDelayMs = 1500;
    const app = await openApp({ backend, user: SAM, errors, wait: false });
    await app.page.waitForTimeout(900);
    check('while the account is loading, onboarding is not offered', (await onboarding(app.page)) === 0);
    check('…a loading screen is', (await app.page.getByText('Loading your data…').count()) === 1);
    await shot(app.page, 'loading');
    await app.settle(1200);
    check('then the app opens on the real profile', (await app.page.getByText('Welcome back, Sam').count()) === 1);
    await app.close();
  }

  // ===== The first sync fails =======================================================================
  {
    const backend = createBackend({ users: [SAM] }).seed('profiles', profileRow());
    backend.offline = true;
    const app = await openApp({ backend, user: SAM, errors, wait: false });
    await app.page.getByText('Couldn’t load your account').waitFor({ timeout: 30000 }).catch(() => {});
    check('a failed first sync says so instead of starting onboarding', (await app.page.getByText('Couldn’t load your account').count()) === 1 && (await onboarding(app.page)) === 0,
      `onboarding shown: ${(await onboarding(app.page)) > 0}`);
    await shot(app.page, 'load-failed');
    check('…and nothing was written to the server meanwhile', backend.writes.length === 0);
    backend.offline = false;
    await app.page.getByText('Try again', { exact: true }).click().catch(() => {});
    await app.settle(1200);
    check('retrying once the connection is back opens the account', (await app.page.getByText('Welcome back, Sam').count()) === 1);
    await app.close();
  }

  // ===== A genuinely new account ====================================================================
  {
    const backend = createBackend({ users: [SAM] });
    const app = await openApp({ backend, user: SAM, errors });
    check('with no profile on the server, onboarding starts', (await onboarding(app.page)) === 1);
    await app.close();
  }

  // ===== An existing user, offline cold start =======================================================
  {
    const backend = createBackend({ users: [SAM] }).seed('profiles', profileRow()).seed('steps_entries', { date: iso(1), steps: 8000 });
    const app = await openApp({ backend, user: SAM, errors });
    backend.offline = true;
    await app.reload();
    await app.settle(1500);
    check('someone already set up on this phone gets straight in offline', (await app.page.getByText('Welcome back, Sam').count()) === 1);
    check('…with their data', (await app.state()).stepsHistory.length === 1);
    await app.close();
  }

  // ===== Two people, one phone ======================================================================
  {
    const backend = createBackend({ users: [SAM, DANA] })
      .seed('profiles', profileRow())
      .seed('steps_entries', { date: iso(1), steps: 8000 })
      .seed('profiles', profileRow({ id: OTHER_UID, name: 'Dana', weight_kg: 62, target_weight_kg: 60 }))
      .seed('steps_entries', { date: iso(1), steps: 3000 }, OTHER_UID);
    const app = await openApp({ backend, user: SAM, errors });
    const { page } = app;
    const signOut = async () => {
      await app.tab('Profile');
      await page.getByText('Sign out', { exact: true }).click();
      await page.getByText('Yes, sign out', { exact: true }).click();
      await app.settle(800);
    };
    const signIn = async (user) => {
      await page.getByPlaceholder('Email').fill(user.email);
      await page.getByPlaceholder('Password').fill(user.password);
      await page.getByText('Sign In', { exact: true }).click();
    };
    const save = async () => {
      await page.getByText('Save', { exact: true }).first().click();
      await app.settle(600);
    };

    // Sam logs steps with no connection, so the write is still queued when they hand the phone over.
    backend.offline = true;
    await page.getByLabel('Steps', { exact: true }).fill('5555');
    await save();
    check('(setup) Sam has an unsent change', (await app.queue()).pendingOps.length === 1);
    await signOut();
    check('signing out works offline', (await page.getByPlaceholder('Email').count()) === 1);
    let s = await app.state();
    check('…and takes Sam’s data off the screen and out of the app’s storage', !s.profile && !s.stepsHistory?.length, JSON.stringify({ profile: s.profile?.name, steps: s.stepsHistory?.length }));
    check('…but keeps the unsent change for when Sam is back', (await app.queue()).pendingOps.length === 1);

    backend.offline = false;
    backend.readDelayMs = 700;
    await signIn(DANA);
    await page.waitForTimeout(500);
    check('Dana never sees Sam’s account while hers loads', (await page.getByText(/Sam/).count()) === 0 && (await onboarding(page)) === 0);
    backend.readDelayMs = 0;
    await app.settle(1500);
    check('Dana lands in her own account', (await page.getByText('Welcome back, Dana').count()) === 1);
    s = await app.state();
    check('…with only her data', s.profile?.name === 'Dana' && s.stepsHistory.length === 1 && s.stepsHistory[0].steps === 3000, JSON.stringify(s.stepsHistory));
    await page.getByLabel('Sleep in hours', { exact: true }).fill('7');
    await save();
    check('Dana’s own changes sync', backend.find('sleep_entries', (r) => r.user_id === OTHER_UID)?.hours === 7);
    check('Sam’s unsent change is not sent as Dana', !backend.writes.some((w) => w.refused) && !backend.rows('steps_entries').some((r) => r.steps === 5555),
      `refused writes: ${backend.writes.filter((w) => w.refused).length}`);
    check('…and doesn’t show up as Dana’s problem', (await page.getByText(/waiting to sync|aren't syncing|accepted by the server/).count()) === 0);
    await shot(page, 'dana');

    await signOut();
    await signIn(SAM);
    await app.settle(1800);
    check('Sam signs back in to his own account', (await page.getByText('Welcome back, Sam').count()) === 1);
    const samSteps = backend.find('steps_entries', (r) => r.user_id === UID && r.date === iso(0));
    check('…and the change he made offline finally reaches the server', samSteps?.steps === 5555, JSON.stringify(samSteps));
    s = await app.state();
    check('…and is on his screen, alongside what was already there', s.stepsHistory.some((x) => x.steps === 5555) && s.stepsHistory.some((x) => x.steps === 8000), JSON.stringify(s.stepsHistory));
    check('Dana’s rows were never touched', backend.find('steps_entries', (r) => r.user_id === OTHER_UID)?.steps === 3000 && backend.find('profiles', (r) => r.id === OTHER_UID)?.name === 'Dana');
    await app.close();
  }
}
