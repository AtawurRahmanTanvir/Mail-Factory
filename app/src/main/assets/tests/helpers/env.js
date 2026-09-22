/* Test environment resolution — NO absolute paths.
 * Everything resolves relative to the project root (the directory that
 * contains this tests/ folder), with env-var overrides for portability:
 *
 *   MF_INDEX_URL / MF_INDEX_FILE  artifact under test (default <root>/index.html)
 *   MF_PLAYWRIGHT_CORE            playwright-core module directory
 *   MF_CHROMIUM                   chromium/headless-shell executable
 *   MF_ORIG_SOURCE                original monolith (visual harness)
 *
 * Default discovery for the dev-only browser tooling walks sibling
 * directories of the project root (a workspace layout of
 *   <workspace>/MAIL_FACTORY + <workspace>/testenv + <workspace>/.cache
 * ), so the suites run from any checkout or extracted ZIP without edits.
 */
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function resolvePlaywrightCore() {
  if (process.env.MF_PLAYWRIGHT_CORE) {
    return require(process.env.MF_PLAYWRIGHT_CORE);
  }
  try { return require('playwright-core'); } catch (_) { /* not on this Node path */ }
  const sibling = path.join(PROJECT_ROOT, '..', 'testenv', 'node_modules', 'playwright-core');
  return require(sibling);
}

function resolveChromium() {
  if (process.env.MF_CHROMIUM) return process.env.MF_CHROMIUM;
  const cacheRoot = path.join(PROJECT_ROOT, '..', '.cache', 'ms-playwright');
  const candidates = [];
  if (fs.existsSync(cacheRoot)) {
    for (const dir of fs.readdirSync(cacheRoot)) {
      for (const rel of [
        'chrome-headless-shell-linux64/chrome-headless-shell',
        'chrome-linux64/chrome',
        'chrome-linux/chrome',
      ]) {
        const full = path.join(cacheRoot, dir, rel);
        if (fs.existsSync(full)) candidates.push(full);
      }
    }
  }
  if (candidates.length) return candidates.sort().pop(); // newest build
  throw new Error(
    'Chromium not found. Set MF_CHROMIUM=/path/to/chrome (dev-only dependency; ' +
    'the application itself has zero runtime dependencies).');
}

function resolveIndex() {
  if (process.env.MF_INDEX_URL) return process.env.MF_INDEX_URL;
  if (process.env.MF_INDEX_FILE) {
    return 'file://' + path.resolve(process.env.MF_INDEX_FILE);
  }
  return 'file://' + path.join(PROJECT_ROOT, 'index.html');
}

function resolveOrigSource() {
  return process.env.MF_ORIG_SOURCE ||
    path.join(PROJECT_ROOT, '..', 'uploads', 'mail-factory.html');
}

module.exports = {
  PROJECT_ROOT,
  chromium: resolvePlaywrightCore().chromium,
  executablePath: resolveChromium,
  INDEX: resolveIndex(),
  ORIG_SOURCE: resolveOrigSource(),
};
