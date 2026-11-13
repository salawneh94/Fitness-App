// Signing in, and getting back in after forgetting the password.
import { UID, createBackend, openApp, profileRow } from '../lib/harness.mjs';

export default async function ({ check, errors, shot }) {
  const SAM = { id: UID, email: 'sam@example.com', password: 'old-password' };
  const backend = createBackend({ users: [SAM] }).seed('profiles', profileRow());
  const app = await openApp({ backend, user: null, errors });
  const { page } = app;
  const press = async (label) => {
    await page.getByText(label, { exact: true }).click();
    await app.settle(500);
  };
  const signedIn = async () => (await page.getByText('Welcome back, Sam').count()) === 1;

  check('signed out, the app opens on sign-in', (await page.getByPlaceholder('Email').count()) === 1);
  await page.getByPlaceholder('Email').fill(SAM.email);
  await page.getByPlaceholder('Password').fill('not-my-password');
  await press('Sign In');
  check('a wrong password is refused with the reason', (await page.getByText('Invalid login credentials').count()) === 1 && !(await signedIn()));

  // --- Forgot password -----------------------------------------------------------------------------
  await press('Forgot password?');
  check('the email typed so far carries over', (await page.getByPlaceholder('Email').inputValue()) === SAM.email);
  check('…and the earlier error doesn’t', (await page.getByText('Invalid login credentials').count()) === 0);
  await press('Send reset code');
  const code = backend.recoveryCodes[SAM.email];
  check('a code is requested for that address', /^\d{6}$/.test(code ?? ''), `code: ${code}`);
  check('the next step asks for the code and a new password', (await page.getByLabel('Code from the email').count()) === 1 && (await page.getByLabel('New password').count()) === 1);
  await shot(page, 'reset');

  const submit = page.getByText('Set new password', { exact: true });
  const disabled = () => submit.evaluate((el) => el.closest('[aria-disabled]')?.getAttribute('aria-disabled') === 'true');
  await page.getByLabel('Code from the email').fill('12');
  await page.getByLabel('New password').fill('brand-new-pass');
  check('an incomplete code can’t be submitted', await disabled());
  await page.getByLabel('Code from the email').fill(code === '000000' ? '111111' : '000000');
  await page.getByLabel('New password').fill('abc');
  check('nor can a password that’s too short', await disabled());

  await page.getByLabel('New password').fill('brand-new-pass');
  await press('Set new password');
  check('a wrong code is refused, in plain words', (await page.getByText('That code is wrong or has expired. Check it, or send a new one.').count()) === 1);
  check('…without signing in or changing the password', !(await signedIn()) && SAM.password === 'old-password');

  await page.getByLabel('Code from the email').fill(code);
  await page.getByLabel('New password').fill('brand-new-pass');
  await press('Set new password');
  await app.settle(1200);
  check('the right code sets the new password', SAM.password === 'brand-new-pass');
  check('…and signs straight in to the account', await signedIn());
  check('…whose data loaded as usual', (await app.state()).profile?.name === 'Sam');

  // --- The new password is the one that works from now on ----------------------------------------
  await app.tab('Profile');
  await press('Sign out');
  await press('Yes, sign out');
  await page.getByPlaceholder('Email').fill(SAM.email);
  await page.getByPlaceholder('Password').fill('old-password');
  await press('Sign In');
  check('the old password no longer works', (await page.getByText('Invalid login credentials').count()) === 1);
  await page.getByPlaceholder('Password').fill('brand-new-pass');
  await press('Sign In');
  await app.settle(1200);
  check('the new one does', await signedIn());

  // --- An address with no account ------------------------------------------------------------------
  await app.tab('Profile');
  await press('Sign out');
  await press('Yes, sign out');
  await press('Forgot password?');
  await page.getByPlaceholder('Email').fill('nobody@example.com');
  await press('Send reset code');
  check('an unknown address gets the same screen — no telling who has an account',
    (await page.getByLabel('Code from the email').count()) === 1 && (await page.getByText(/If there’s an account for nobody@example\.com/).count()) === 1);
  await press('Sign in');
  check('…with a way back to sign-in', (await page.getByText('Welcome back', { exact: true }).count()) === 1);
  await app.close();
}
