// Browser tests for the mobile app, run against its web export with a fake Supabase behind it.
//
//   pnpm --filter mobile e2e              build, serve, run every suite
//   pnpm --filter mobile e2e sync auth    only the named suites
//   E2E_SKIP_BUILD=1 pnpm --filter mobile e2e   reuse the last build
//
// The unit tests cover the arithmetic in packages/shared. These cover what they can't: the store,
// the sync queue and the screens — which is where nearly every real bug in this app has lived.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, closeBrowser, launch } from './lib/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const dist = join(appDir, '.e2e-dist');
export const SHOTS = join(here, '.screenshots');

if (!process.env.E2E_SKIP_BUILD || !existsSync(join(dist, 'index.html'))) {
  console.log('Building the web export…');
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist], {
    cwd: appDir,
    stdio: ['ignore', 'ignore', 'inherit'],
    // The flag that lets the suite past the paywall; web-only by construction (see useEntitlementStore).
    env: { ...process.env, EXPO_PUBLIC_E2E: '1', EXPO_NO_TELEMETRY: '1', CI: '1' },
  });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, BASE_URL).pathname));
  // A single-page app: anything that isn't a file on disk is a route, served by index.html.
  const file = path.startsWith(dist) && existsSync(path) && statSync(path).isFile() ? path : join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(Number(new URL(BASE_URL).port), ok));

mkdirSync(SHOTS, { recursive: true });
const wanted = process.argv.slice(2);
const suites = readdirSync(join(here, 'suites'))
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => f.replace(/\.mjs$/, ''))
  .filter((name) => wanted.length === 0 || wanted.includes(name))
  .sort();

await launch();
let failed = 0;
let passed = 0;
for (const name of suites) {
  const errors = [];
  const lines = [];
  const check = (label, ok, detail = '') => {
    ok ? passed++ : failed++;
    lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  };
  const started = Date.now();
  try {
    const { default: suite } = await import(`./suites/${name}.mjs`);
    await suite({ check, errors, shot: (page, file) => page.screenshot({ path: join(SHOTS, `${name}-${file}.png`) }) });
  } catch (e) {
    failed++;
    lines.push(`  FAIL  suite stopped: ${String(e.message).split('\n')[0]}`);
  }
  // An uncaught exception in the page is a failure even when every assertion happened to pass.
  for (const e of errors) {
    failed++;
    lines.push(`  FAIL  ${e}`);
  }
  console.log(`\n${name} (${((Date.now() - started) / 1000).toFixed(1)}s)\n${lines.join('\n')}`);
}

await closeBrowser();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
