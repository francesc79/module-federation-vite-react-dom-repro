import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const projectDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const viteBinary = resolve(projectDirectory, 'node_modules/vite/bin/vite.js');
const withoutFederation = process.argv.includes('--without-federation');
const port = 5173;
const url = `http://127.0.0.1:${port}/`;

async function assertPortIsFree() {
  const server = createServer();

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.close(error => (error ? reject(error) : resolvePromise()));
    });
  });
}

function findChromeExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  return [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find(existsSync);
}

await assertPortIsFree();
rmSync(resolve(projectDirectory, 'node_modules/.vite'), { recursive: true, force: true });

const vite = spawn(process.execPath, [viteBinary, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: projectDirectory,
  detached: true,
  env: {
    ...process.env,
    CHOKIDAR_USEPOLLING: 'true',
    DEBUG: 'vite:deps',
    NO_FEDERATION: withoutFederation ? 'true' : 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let viteLog = '';
vite.stdout.on('data', data => (viteLog += data.toString()));
vite.stderr.on('data', data => (viteLog += data.toString()));

function stopVite() {
  try {
    process.kill(-vite.pid, 'SIGKILL');
  } catch {
    // The process group has already exited.
  }
}

const executablePath = findChromeExecutable();
let browser;

try {
  browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
  });
} catch (error) {
  stopVite();
  throw error;
}

const page = await browser.newPage();
const pageErrors = [];
const moduleResponses = [];

page.on('pageerror', error => pageErrors.push(error.message));
page.on('response', async response => {
  if (!response.url().includes('/node_modules/.vite/deps/react-dom')) return;

  try {
    moduleResponses.push({
      body: await response.text(),
      url: response.url(),
    });
  } catch {
    // An outdated response may be aborted while Vite publishes a new generation.
  }
});

try {
  const pollStartedAt = Date.now();
  let firstResponseSeen = false;

  while (!firstResponseSeen && Date.now() - pollStartedAt < 120000) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 100 });
      firstResponseSeen = true;
    } catch {
      await sleep(100);
    }
  }

  if (!firstResponseSeen) {
    throw new Error('Timed out waiting for Vite to bind the port');
  }

  let appRendered = false;
  let mismatchReproduced = false;
  const outcomeStartedAt = Date.now();

  while (Date.now() - outcomeStartedAt < 30000) {
    mismatchReproduced = pageErrors.some(error => error.includes("does not provide an export named 't'"));
    appRendered = await page
      .locator('[data-testid="app-ready"]')
      .isVisible()
      .catch(() => false);

    if (mismatchReproduced || appRendered) break;
    await sleep(100);
  }

  const reactDom = moduleResponses.find(response => /\/react-dom\.js\?/.test(response.url));
  const reactDomClient = moduleResponses.find(response => /\/react-dom_client\.js\?/.test(response.url));

  console.log(`Mode: ${withoutFederation ? 'control without Module Federation' : 'Module Federation 1.19.1'}`);
  console.log(`Page errors: ${pageErrors.length ? JSON.stringify(pageErrors) : 'none'}`);

  if (reactDom) {
    console.log(`react-dom.js: ${reactDom.url}`);
    console.log(`react-dom.js exports 't': ${/export\s*\{[^}]*\bas t\b/.test(reactDom.body)}`);
  }
  if (reactDomClient) {
    console.log(`react-dom_client.js: ${reactDomClient.url}`);
    console.log(
      `react-dom_client.js imports 't': ${/import\s*\{\s*t as require_react_dom\s*\}/.test(reactDomClient.body)}`,
    );
  }

  if (mismatchReproduced) {
    console.log('\nREPRODUCED: mixed React DOM optimizer generations were served.');
    console.log(viteLog.split('\n').slice(-30).join('\n'));
    process.exitCode = 1;
  } else if (appRendered) {
    console.log('\nPASS: the application rendered with coherent React DOM modules.');
    process.exitCode = 0;
  } else {
    console.log('\nINCONCLUSIVE: the app did not render, but the target mismatch was not observed.');
    console.log(viteLog.split('\n').slice(-30).join('\n'));
    process.exitCode = 2;
  }
} finally {
  await browser.close();
  stopVite();
  await sleep(300);
}
