// Shared plumbing for the browser suites: a Chromium page pointed at the app's web export, and a
// stand-in for Supabase that behaves like the real one in the ways the app's bugs have depended on.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8099';
export const UID = '11111111-2222-3333-4444-555555555555';
export const OTHER_UID = '99999999-8888-7777-6666-555555555555';

// --- dates ------------------------------------------------------------------------------------

/** YYYY-MM-DD for `back` days ago, in the machine's own timezone — the same day the app calls today. */
export const iso = (back = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysAgo = (back) => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return d;
};
/** The label DayChips gives a day more than one back: "Fri 2". */
export const chip = (back) => `${daysAgo(back).toLocaleDateString(undefined, { weekday: 'short' })} ${daysAgo(back).getDate()}`;

// --- seed data --------------------------------------------------------------------------------

export const profileRow = (extra = {}) => ({
  id: UID, name: 'Sam', age: 31, sex: 'male', height_cm: 180, weight_kg: 84, goal: 'lose_fat', target_weight_kg: 78,
  timeframe_weeks: 12, expectations: '', activity_level: 'moderate', preferred_days_per_week: 3, unit_system: 'metric',
  created_at: '2026-08-01T00:00:00Z', plan_template_id: null, plan_started_on: null, updated_at: '2026-10-03T00:00:00Z', ...extra,
});

/** Tables whose rows are unique per (user, day) rather than by id — mirrors the migrations. */
const NATURAL_KEY = {
  weight_entries: ['user_id', 'date'], steps_entries: ['user_id', 'date'], sleep_entries: ['user_id', 'date'],
  body_measurements: ['user_id', 'date'], water_entries: ['user_id', 'date'], scheduled_workouts: ['user_id', 'day'],
};
const ownerColumn = (table) => (table === 'profiles' ? 'id' : 'user_id');

let idCounter = 0;
let clock = Date.parse('2026-10-03T00:00:00Z');
/** Server timestamps only ever move forward, like a real database's now(). */
const serverNow = () => new Date((clock = Math.max(clock + 1000, Date.now()))).toISOString();

const fakeJwt = (userId) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 2592000 })}.sig`;
};
const subOf = (authorization) => {
  try {
    return JSON.parse(Buffer.from((authorization ?? '').replace(/^Bearer /, '').split('.')[1], 'base64url').toString()).sub ?? null;
  } catch {
    return null;
  }
};
const sessionFor = (user) => {
  const t = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeJwt(user.id), token_type: 'bearer', expires_in: 2592000, expires_at: t + 2592000, refresh_token: `refresh-${user.id}`,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: '2026-08-01T00:00:00Z' },
  };
};

/**
 * A fake Supabase: PostgREST and the auth endpoints, in memory.
 *
 * It is deliberately faithful where this app has been bitten before:
 *  - rows are keyed by the same unique constraints as the migrations, so an upsert without the
 *    right on_conflict would collide here too;
 *  - a response is capped at `maxRows` (1,000 on hosted Supabase) unless the request pages;
 *  - writes for another user's rows are refused, as row-level security would;
 *  - a failed request looks like a failed request (`offline`, `rejectWrite`) rather than an empty one.
 */
export function createBackend({ users = [{ id: UID, email: 's@example.com', password: 'hunter22' }], maxRows = 1000 } = {}) {
  const backend = {
    /** table -> Map(key -> row) */
    tables: {},
    users,
    maxRows,
    /** Abort every request, as with no connection. */
    offline: false,
    /** (table, row, method) => { status, code, message } to refuse a write; null to accept it. */
    rejectWrite: null,
    /** Hold each write this long before answering, to open the window a slow network would. */
    writeDelayMs: 0,
    /** Every write that arrived, accepted or not. */
    writes: [],
    /** Recovery codes issued by "forgot password": email -> code. */
    recoveryCodes: {},
    reads: [],

    rows: (table) => [...(backend.tables[table]?.values() ?? [])],
    keyOf(table, row) {
      const cols = NATURAL_KEY[table];
      return cols ? cols.map((c) => row[c]).join('|') : row.id;
    },
    /** Seed rows, owned by `userId` unless they say otherwise. */
    seed(table, rows, userId = UID) {
      const map = (backend.tables[table] ??= new Map());
      for (const r of [rows].flat()) {
        const row = { updated_at: '2026-10-03T00:00:00Z', ...r };
        if (table !== 'profiles') row.user_id ??= userId;
        row.id ??= `seed-${++idCounter}`;
        map.set(backend.keyOf(table, row), row);
      }
      return backend;
    },
    find: (table, pred) => backend.rows(table).find(pred),
  };

  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function rest(route) {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const me = subOf(req.headers().authorization);
    const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(k));
    const matches = (row) =>
      row[ownerColumn(table)] === me && // row-level security: only ever the caller's own rows
      filters.every(([col, expr]) => {
        const [op, ...rest] = expr.split('.');
        const value = rest.join('.');
        if (op === 'eq') return String(row[col]) === value;
        if (op === 'gt') return String(row[col]) > value;
        return true;
      });

    if (req.method() === 'GET') {
      let rows = backend.rows(table).filter(matches);
      const order = url.searchParams.get('order');
      if (order) {
        const cols = order.split(',').map((o) => o.split('.')[0]);
        rows.sort((a, b) => cols.map((c) => String(a[c] ?? '').localeCompare(String(b[c] ?? ''))).find((n) => n !== 0) ?? 0);
      }
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? Infinity), backend.maxRows);
      backend.reads.push({ table, offset, limit, total: rows.length });
      const page = rows.slice(offset, offset + limit);
      // With Prefer: count=exact, PostgREST reports the full match count alongside the page.
      const headers = /count=exact/.test(req.headers().prefer ?? '')
        ? { 'content-range': `${page.length ? `${offset}-${offset + page.length - 1}` : '*'}/${rows.length}`, 'access-control-expose-headers': 'content-range' }
        : {};
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(page) });
    }

    const map = (backend.tables[table] ??= new Map());
    if (backend.writeDelayMs) await new Promise((r) => setTimeout(r, backend.writeDelayMs));
    if (req.method() === 'POST') {
      for (const incoming of [req.postDataJSON()].flat()) {
        const refusal =
          incoming[ownerColumn(table)] !== me
            ? { status: 403, code: '42501', message: `new row violates row-level security policy for table "${table}"` }
            : backend.rejectWrite?.(table, incoming, 'POST');
        backend.writes.push({ method: 'POST', table, row: incoming, refused: Boolean(refusal), onConflict: url.searchParams.get('on_conflict') });
        if (refusal) return json(route, refusal.status, { code: refusal.code, message: refusal.message, details: null, hint: null });
        const onConflict = url.searchParams.get('on_conflict');
        const natural = backend.keyOf(table, incoming);
        const existing = map.get(natural);
        // Without the right conflict target, a second row for the same (user, day) is a unique violation.
        if (existing && NATURAL_KEY[table] && onConflict !== NATURAL_KEY[table].join(',')) {
          return json(route, 409, { code: '23505', message: `duplicate key value violates unique constraint on "${table}"`, details: null, hint: null });
        }
        map.set(natural, { id: existing?.id ?? incoming.id ?? `srv-${++idCounter}`, ...existing, ...incoming, updated_at: serverNow() });
      }
      return json(route, 201, []);
    }
    if (req.method() === 'DELETE') {
      const refusal = backend.rejectWrite?.(table, Object.fromEntries(filters.map(([c, e]) => [c, e.replace(/^eq\./, '')])), 'DELETE');
      backend.writes.push({ method: 'DELETE', table, filters, refused: Boolean(refusal) });
      if (refusal) return json(route, refusal.status, { code: refusal.code, message: refusal.message, details: null, hint: null });
      for (const [key, row] of map) if (matches(row)) map.delete(key);
      return json(route, 204, []);
    }
    return json(route, 405, { message: 'method not allowed' });
  }

  async function auth(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/auth\/v1\//, '');
    const body = req.method() === 'GET' ? {} : (req.postDataJSON() ?? {});
    const byEmail = (email) => backend.users.find((u) => u.email.toLowerCase() === String(email ?? '').toLowerCase());

    if (path === 'token' && url.searchParams.get('grant_type') === 'password') {
      const user = byEmail(body.email);
      if (!user || user.password !== body.password) return json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(route, 200, sessionFor(user));
    }
    if (path === 'token') {
      const user = backend.users.find((u) => `refresh-${u.id}` === body.refresh_token) ?? backend.users[0];
      return json(route, 200, sessionFor(user));
    }
    if (path === 'recover') {
      const user = byEmail(body.email);
      // Like the real endpoint: always "ok", so it can't be used to discover who has an account.
      if (user) backend.recoveryCodes[user.email] = String(100000 + Math.floor(Math.random() * 900000));
      return json(route, 200, {});
    }
    if (path === 'verify') {
      const user = byEmail(body.email);
      if (!user || body.type !== 'recovery' || !body.token || backend.recoveryCodes[user.email] !== body.token) {
        return json(route, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      delete backend.recoveryCodes[user.email];
      return json(route, 200, sessionFor(user));
    }
    if (path === 'user') {
      const user = backend.users.find((u) => u.id === subOf(req.headers().authorization));
      if (!user) return json(route, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      if (req.method() === 'PUT' && body.password) {
        if (body.password.length < 6) return json(route, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        user.password = body.password;
      }
      return json(route, 200, sessionFor(user).user);
    }
    if (path === 'logout') return route.fulfill({ status: 204, body: '' });
    return json(route, 200, {});
  }

  backend.attach = async (page) => {
    const guarded = (handler) => (route) => (backend.offline ? route.abort('internetdisconnected') : handler(route));
    await page.route('**/rest/v1/**', guarded(rest));
    await page.route('**/auth/v1/**', guarded(auth));
    await page.route('**/functions/v1/**', guarded((route) => json(route, 200, {})));
    await page.route('**/storage/v1/**', guarded((route) => json(route, 200, [])));
  };
  backend.sessionFor = sessionFor;
  return backend;
}

// --- browser ----------------------------------------------------------------------------------

let browser;
export async function launch() {
  // Sandboxed dev machines ship their own Chromium; CI installs Playwright's.
  const local = process.env.E2E_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  browser = await chromium.launch({ executablePath: local, args: ['--no-sandbox'] });
  return browser;
}
export const closeBrowser = () => browser?.close();

/**
 * Open the app in a fresh browser profile.
 *
 * `user` is who is already signed in (their session is planted before the app boots); pass null to
 * start at the sign-in screen. Returns the page plus readers for what the app has persisted.
 */
export async function openApp({ backend = createBackend(), user = backend.users[0], errors = [], context } = {}) {
  const ctx = context ?? (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await backend.attach(page);
  if (user) {
    await page.addInitScript((session) => {
      if (!localStorage.getItem('e2e-session-planted')) {
        localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(session));
        localStorage.setItem('e2e-session-planted', '1');
      }
    }, backend.sessionFor(user));
  }
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const app = {
    page,
    ctx,
    backend,
    /** Let in-flight sync and renders finish. */
    settle: async (ms = 400) => {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(ms);
    },
    state: () => page.evaluate(() => JSON.parse(localStorage.getItem('fitness-app-storage') ?? '{"state":{}}').state),
    queue: () => page.evaluate(() => JSON.parse(localStorage.getItem('fitness-app-sync-queue') ?? '{"state":{}}').state),
    tab: async (name) => {
      await page.getByText(name, { exact: true }).last().click();
      await app.settle();
    },
    reload: async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await app.settle(800);
    },
    close: () => (context ? page.close() : ctx.close()),
  };
  await app.settle(1200);
  return app;
}
