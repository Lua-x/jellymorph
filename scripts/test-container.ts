/**
 * Runtime tests for the Docker image (docs/architecture.md §15), run in CI:
 *
 *   node scripts/test-container.ts <image> [--e2e]
 *
 * Every container runs like in production: read-only root filesystem, /tmp as tmpfs, no
 * capabilities. Checked: health endpoint, generated config.js and manifest, security and cache
 * headers, SPA fallback, invalid settings, the /jellyfin proxy (incl. WebSocket and start before
 * Jellyfin) and, with --e2e, the whole Playwright suite in demo mode under the real CSP.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const image = process.argv[2] ?? '';
const withE2e = process.argv.includes('--e2e');
if (!image || image.startsWith('--')) {
  console.error('Usage: node scripts/test-container.ts <image> [--e2e]');
  process.exit(2);
}

const PREFIX = 'jellymorph-test';
const NETWORK = `${PREFIX}-net`;
const HARDENING = ['--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL'];
const HARDENING_EXTRA = ['--security-opt', 'no-new-privileges'];

interface Result {
  status: number;
  stdout: string;
  stderr: string;
}

function docker(args: string[], options: { allowFailure?: boolean } = {}): Result {
  // A container that should have stopped but serves instead must not hang the run.
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120_000 });
  const outcome = { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
  if (outcome.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args.join(' ')} failed:\n${outcome.stderr}`);
  }
  return outcome;
}

const started: string[] = [];

function start(
  name: string,
  port: number | null,
  env: Record<string, string>,
  extra: string[] = [],
) {
  const container = `${PREFIX}-${name}`;
  const envArgs = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  const portArgs = port === null ? [] : ['-p', `${String(port)}:8080`];
  docker(['rm', '-f', container], { allowFailure: true });
  docker([
    'run',
    '-d',
    '--name',
    container,
    ...HARDENING,
    ...HARDENING_EXTRA,
    ...portArgs,
    ...envArgs,
    ...extra,
    image,
  ]);
  started.push(container);
  return container;
}

/**
 * Reports a failure. In GitHub Actions also as an annotation: those are readable on the run page
 * and through the API without access to the raw job log.
 */
function report(title: string, details: string) {
  console.error(`  ✗ ${title}\n${details}`);
  if (process.env.GITHUB_ACTIONS) {
    const escape = (text: string) =>
      text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.log(
      `::error title=${escape(title).replaceAll(',', '%2C')}::${escape(details.slice(-6000))}`,
    );
  }
}

function logsOf(container: string): string {
  const result = docker(['logs', container], { allowFailure: true });
  return `${result.stdout}${result.stderr}`;
}

async function waitFor(check: () => Promise<boolean>, what: string, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function waitHealthy(port: number, container: string) {
  try {
    await waitFor(async () => (await fetch(url(port, '/healthz'))).ok, `${container} to serve`);
  } catch (error) {
    report(`${container} did not start`, logsOf(container));
    throw error;
  }
}

const url = (port: number, path: string) => `http://127.0.0.1:${String(port)}${path}`;

async function get(port: number, path: string, init?: RequestInit) {
  const response = await fetch(url(port, path), { redirect: 'manual', ...init });
  return { response, body: await response.text() };
}

function header(response: Response, name: string): string {
  return response.headers.get(name) ?? '';
}

async function readConfig(port: number): Promise<unknown> {
  const { response, body } = await get(port, '/config.js');
  assert.equal(response.status, 200);
  assert.match(header(response, 'content-type'), /javascript/);
  assert.equal(header(response, 'cache-control'), 'no-cache');
  const sandbox: { window: { __APP_CONFIG__?: unknown } } = { window: {} };
  runInNewContext(body, sandbox);
  // Plain data from this realm: objects created inside the sandbox have a different prototype.
  return JSON.parse(JSON.stringify(sandbox.window.__APP_CONFIG__)) as unknown;
}

function cspOf(response: Response): Map<string, string> {
  const directives = new Map<string, string>();
  for (const part of header(response, 'content-security-policy').split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives.set(name, values.join(' '));
  }
  return directives;
}

let failures = 0;

async function check(name: string, container: string, run: () => Promise<void> | void) {
  try {
    await run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    report(name, `${String(error)}\n--- logs of ${container}:\n${logsOf(container)}`);
  }
}

/** Minimal Jellyfin stand-in: echoes requests as JSON and answers WebSocket upgrades. */
const UPSTREAM = `
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ url: request.url, headers: request.headers }));
});
server.on('upgrade', (request, socket) => {
  const accept = createHash('sha1')
    .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\n' +
    'Sec-WebSocket-Accept: ' + accept + '\\r\\n\\r\\n');
  const payload = Buffer.from('hello');
  socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
});
server.listen(8096);
`;

async function defaults() {
  console.log('Defaults');
  const port = 18081;
  const container = start('defaults', port, {});
  await waitHealthy(port, container);

  await check('health endpoint and healthcheck command', container, async () => {
    const { response, body } = await get(port, '/healthz');
    assert.equal(response.status, 200);
    assert.equal(body, 'ok\n');
    const healthcheck = docker(
      ['exec', container, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/healthz'],
      { allowFailure: true },
    );
    assert.equal(healthcheck.status, 0, healthcheck.stderr);
  });

  await check('runs as the unprivileged nginx user', container, () => {
    assert.equal(docker(['exec', container, 'id', '-u']).stdout.trim(), '101');
  });

  await check('config.js with the defaults', container, async () => {
    assert.deepEqual(await readConfig(port), {
      jellyfinUrl: null,
      lockServer: false,
      proxyPath: null,
      defaultTheme: 'default',
      appTitle: 'Jellymorph',
      demoMode: false,
    });
  });

  let assetPath = '';
  await check('index.html: no-cache and security headers', container, async () => {
    const { response, body } = await get(port, '/');
    assert.equal(response.status, 200);
    assert.match(header(response, 'content-type'), /text\/html/);
    assert.equal(header(response, 'cache-control'), 'no-cache');
    assert.equal(header(response, 'x-content-type-options'), 'nosniff');
    assert.equal(header(response, 'referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(header(response, 'permissions-policy'), /fullscreen=\(self\)/);
    const csp = cspOf(response);
    assert.equal(csp.get('default-src'), "'self'");
    assert.equal(csp.get('script-src'), "'self'");
    assert.equal(csp.get('connect-src'), "'self' https: http: wss: ws:");
    assert.equal(csp.get('frame-ancestors'), "'none'");
    assert.equal(header(response, 'server'), 'nginx', 'no version in the Server header');
    assetPath = /src="(\/assets\/index-[^"]+\.js)"/.exec(body)?.[1] ?? '';
    assert.ok(assetPath, 'entry script in index.html');
  });

  await check('hashed assets: immutable and gzip', container, async () => {
    const { response } = await get(port, assetPath, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(response.status, 200);
    assert.equal(header(response, 'cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(header(response, 'content-encoding'), 'gzip');
    assert.equal(header(response, 'x-content-type-options'), 'nosniff');
  });

  await check('routes fall back to the app, missing assets do not', container, async () => {
    const route = await get(port, '/library/abc?sort=name');
    assert.equal(route.response.status, 200);
    assert.match(route.body, /<div id="root">/);
    assert.equal(header(route.response, 'cache-control'), 'no-cache');
    assert.equal((await get(port, '/assets/missing-chunk.js')).response.status, 404);
    assert.equal((await get(port, '/.vite/manifest.json')).response.status, 404);
  });

  await check('web manifest and icons', container, async () => {
    const { response, body } = await get(port, '/manifest.webmanifest');
    assert.equal(response.status, 200);
    assert.match(header(response, 'content-type'), /application\/manifest\+json/);
    const manifest = JSON.parse(body) as { name: string; icons: { src: string }[] };
    assert.equal(manifest.name, 'Jellymorph');
    for (const icon of manifest.icons) {
      assert.equal((await get(port, icon.src)).response.status, 200, icon.src);
    }
  });

  await check('demo service worker is revalidated', container, async () => {
    const { response } = await get(port, '/mockServiceWorker.js');
    assert.equal(response.status, 200);
    assert.equal(header(response, 'cache-control'), 'no-cache');
  });
}

async function fixedServer() {
  console.log('Fixed server, custom title and theme');
  const port = 18082;
  const title = 'Kino "Süd" \\ 1';
  const container = start('fixed', port, {
    JELLYFIN_URL: 'https://jf.example.com:8920/base/',
    LOCK_SERVER: 'true',
    DEFAULT_THEME: 'default',
    APP_TITLE: title,
  });
  await waitHealthy(port, container);

  await check('config.js keeps the values and escapes the title', container, async () => {
    assert.deepEqual(await readConfig(port), {
      jellyfinUrl: 'https://jf.example.com:8920/base',
      lockServer: true,
      proxyPath: null,
      defaultTheme: 'default',
      appTitle: title,
      demoMode: false,
    });
  });

  await check('CSP allows exactly the fixed server', container, async () => {
    const csp = cspOf((await get(port, '/')).response);
    assert.equal(csp.get('img-src'), "'self' data: blob: https://jf.example.com:8920");
    assert.equal(csp.get('media-src'), "'self' blob: https://jf.example.com:8920");
    assert.equal(
      csp.get('connect-src'),
      "'self' https://jf.example.com:8920 wss://jf.example.com:8920",
    );
  });

  await check('manifest uses the title', container, async () => {
    const manifest = JSON.parse((await get(port, '/manifest.webmanifest')).body) as {
      name: string;
      short_name: string;
    };
    assert.equal(manifest.name, title);
    assert.equal(manifest.short_name, title);
  });
}

async function arbitraryUser() {
  console.log('Arbitrary user id (e.g. Kubernetes runAsUser)');
  const port = 18083;
  const container = start('uid', port, {}, ['--user', '4242:0']);
  await waitHealthy(port, container);
  await check('serves the app', container, async () => {
    assert.equal((await get(port, '/')).response.status, 200);
  });
}

function invalidSettings() {
  console.log('Invalid settings stop the container');
  const cases: [Record<string, string>, string][] = [
    [{ DEFAULT_THEME: 'nope' }, 'DEFAULT_THEME'],
    [{ LOCK_SERVER: 'maybe' }, 'LOCK_SERVER'],
    [{ DEMO_MODE: 'yes' }, 'DEMO_MODE'],
    [{ JELLYFIN_URL: 'jellyfin:8096' }, 'JELLYFIN_URL'],
    [{ JELLYFIN_PROXY_TARGET: 'http://jellyfin:8096; evil' }, 'JELLYFIN_PROXY_TARGET'],
    [{ LOCK_SERVER: 'true' }, 'LOCK_SERVER=true needs JELLYFIN_URL'],
  ];
  for (const [index, [env, message]] of cases.entries()) {
    const envArgs = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
    const container = `${PREFIX}-invalid-${String(index)}`;
    started.push(container);
    const result = docker(['run', '--rm', '--name', container, ...HARDENING, ...envArgs, image], {
      allowFailure: true,
    });
    const label = Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    if (result.status !== 0 && result.stderr.includes(message)) {
      console.log(`  ✓ ${label}`);
    } else {
      failures += 1;
      report(label, `exit ${String(result.status)}\n${result.stderr}`);
    }
  }
}

async function proxy() {
  console.log('Proxy to Jellyfin');
  const port = 18084;
  docker(['network', 'rm', NETWORK], { allowFailure: true });
  docker(['network', 'create', NETWORK]);
  // Started before the server it proxies to, as compose may do.
  const container = start('proxy', port, { JELLYFIN_PROXY_TARGET: 'http://upstream:8096/' }, [
    '--network',
    NETWORK,
  ]);
  await waitHealthy(port, container);

  await check('starts while Jellyfin is not reachable yet', container, async () => {
    assert.equal((await get(port, '/jellyfin/System/Info/Public')).response.status, 502);
  });

  const upstream = `${PREFIX}-upstream`;
  docker(['rm', '-f', upstream], { allowFailure: true });
  docker([
    'run',
    '-d',
    '--name',
    upstream,
    '--network',
    NETWORK,
    '--network-alias',
    'upstream',
    'node:24-alpine',
    'node',
    '--input-type=module',
    '-e',
    UPSTREAM,
  ]);
  started.push(upstream);

  await check('reaches Jellyfin once it is up', container, async () => {
    await waitFor(
      async () => (await get(port, '/jellyfin/System/Info/Public')).response.status === 200,
      'the proxy to reach the upstream',
    );
  });

  await check('passes path, query and forwarding headers through', container, async () => {
    const { body } = await get(port, '/jellyfin/Items/a%2Fb/PlaybackInfo?UserId=1&Path=%2Fx%20y');
    const echo = JSON.parse(body) as { url: string; headers: Record<string, string> };
    assert.equal(echo.url, '/Items/a%2Fb/PlaybackInfo?UserId=1&Path=%2Fx%20y');
    assert.equal(echo.headers.host, 'upstream:8096');
    assert.equal(echo.headers['x-forwarded-proto'], 'http');
    assert.ok(echo.headers['x-forwarded-for'], 'X-Forwarded-For');
  });

  await check('/jellyfin redirects to /jellyfin/', container, async () => {
    const { response } = await get(port, '/jellyfin');
    assert.equal(response.status, 301);
    assert.equal(header(response, 'location'), '/jellyfin/');
  });

  await check('WebSocket upgrade', container, async () => {
    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/jellyfin/socket?api_key=x`);
      const timer = setTimeout(() => {
        reject(new Error('no WebSocket message'));
      }, 10_000);
      socket.addEventListener('message', (event) => {
        clearTimeout(timer);
        socket.close();
        resolve(String(event.data));
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('WebSocket error'));
      });
    });
    assert.equal(message, 'hello');
  });

  await check('config.js and CSP stay on the own origin', container, async () => {
    const config = (await readConfig(port)) as { proxyPath: string | null };
    assert.equal(config.proxyPath, '/jellyfin');
    const csp = cspOf((await get(port, '/')).response);
    assert.equal(csp.get('connect-src'), "'self'");
    assert.equal(csp.get('img-src'), "'self' data: blob:");
  });
}

async function demoE2e() {
  console.log('Playwright suite in demo mode');
  const port = 18090;
  const container = start('demo', port, { DEMO_MODE: 'true' });
  await waitHealthy(port, container);
  const result = spawnSync('npx', ['playwright', 'test', '--grep-invert', '@shots|@previews'], {
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE_URL: `http://localhost:${String(port)}` },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    failures += 1;
    report('Playwright suite in demo mode', `exited with ${String(result.status)}`);
  } else {
    console.log('  ✓ Playwright suite passed under the container CSP');
  }
}

try {
  await defaults();
  await fixedServer();
  await arbitraryUser();
  invalidSettings();
  await proxy();
  if (withE2e) await demoE2e();
} catch (error) {
  failures += 1;
  report(
    'container tests aborted',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
} finally {
  for (const container of started) docker(['rm', '-f', container], { allowFailure: true });
  docker(['network', 'rm', NETWORK], { allowFailure: true });
}

if (failures > 0) {
  console.error(`\n${String(failures)} container check(s) failed.`);
  process.exit(1);
}
console.log('\nAll container checks passed.');
