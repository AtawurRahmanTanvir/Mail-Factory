/* Edge-case verification — resource lifecycle (§43), responsive floor,
 * reduced-motion accessibility, keyboard navigation, and a broadened
 * placeholder-language sweep (§46 Pass 6 "all variants").
 * Also supports INDEX_URL for http-served validation (GitHub Pages path). */
const env = require('./helpers/env');
const { chromium } = env;

const path = require('path');

const INDEX = env.INDEX;
let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: env.executablePath(),
    args: ['--no-sandbox']
  });

  /* ---------- context 1: instrumented resource-lifecycle probes ---------- */
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED') && !m.text().includes('ERR_BLOCKED_BY_CLIENT')) {
      consoleErrors.push(m.text());
    }
  });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  const APP_ORIGIN = INDEX.startsWith('http') ? new URL(INDEX).origin : INDEX.slice(0, 6);
  await page.route('**/*', r => r.request().url().startsWith(APP_ORIGIN) ? r.continue() : r.abort());
  // Track live interval timers from the very start (leak probe).
  await page.addInitScript(() => {
    window.__liveIntervals = new Set();
    const realSet = window.setInterval, realClear = window.clearInterval;
    window.setInterval = function (fn, ms, ...rest) {
      const id = realSet(fn, ms, ...rest);
      window.__liveIntervals.add(id);
      return id;
    };
    window.clearInterval = function (id) {
      window.__liveIntervals.delete(id);
      return realClear(id);
    };
  });
  await page.goto(INDEX);
  await page.waitForTimeout(500);

  console.log('\n== E1. Resource lifecycle (matrix §43: no timer/listener multiplication) ==');
  const afterLoad = await page.evaluate(() => window.__liveIntervals.size);
  // cycle Check Route (owns the only interval) 4 times
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(60);
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-action="open-engine-subpage"][data-page="checkroute"]').click();
    await page.waitForTimeout(70);
    await page.locator('[data-action="close-engine-subpage"][data-page="checkroute"]').click();
    await page.waitForTimeout(70);
  }
  ok('E1a Check Route clock interval detached on every close (0 live)',
    await page.evaluate(() => window.__liveIntervals.size === 0),
    'live=' + await page.evaluate(() => window.__liveIntervals.size));
  // plain navigation 10× across screens must not spawn intervals either
  for (const s of ['generator', 'library', 'dashboard', 'settings', 'engine']) {
    for (let i = 0; i < 2; i++) { await page.evaluate(n => window.showScreen(n), s); await page.waitForTimeout(25); }
  }
  ok('E1b 10 navigations spawn no interval leaks',
    await page.evaluate(() => window.__liveIntervals.size === 0));
  // dashboard rAF loop pauses off-screen: capture frame-advance probe
  await page.evaluate(() => {
    window.__fxAdvances = 0;
    const canvas = document.getElementById('fx');
    // count draws indirectly: observe canvas context is idle via rAF tracker on same frame source
    window.__rafProbe = () => { window.__fxAdvances++; requestAnimationFrame(window.__rafProbe); };
    requestAnimationFrame(window.__rafProbe);
  });
  await page.waitForTimeout(300);
  const rafBaseline = await page.evaluate(() => window.__fxAdvances);
  // baseline > 0 proves rAF ticks while a screen is active (probe on library screen)
  ok('E1c rAF ticking while any screen active (sanity)', rafBaseline > 10, 'baseline=' + rafBaseline);
  // the dashboard draw loop skips work off-screen: instrument via timestamp of last clear
  const drawIdle = await page.evaluate(async () => {
    // sample fx canvas pixel churn: hash a corner region twice, 400ms apart, while on library screen
    const c = document.getElementById('fx');
    const ctx = c.getContext('2d');
    const snap = () => {
      const d = ctx.getImageData(0, 0, 80, 60).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0;
      return h;
    };
    const a = snap();
    await new Promise(r => setTimeout(r, 400));
    const b = snap();
    return a === b; // identical => not drawing while hidden
  });
  ok('E1d dashboard canvas loop idles while off-screen (identical frames)', drawIdle);

  console.log('\n== E2. Broadened placeholder-language sweep (Pass 6 variants) ==');
  const text = await page.evaluate(() => document.body.innerText.toLowerCase());
  for (const variant of ['coming soon', 'coming', 'soon', 'not available yet', 'not implemented',
    'ui demo', 'todo', 'fixme', 'lorem ipsum', 'under construction']) {
    ok(`E2 "${variant}" absent from visible text`, !text.includes(variant));
  }
  // "demo" needs care: legit nowhere in UI text
  ok('E2 "demo" absent from visible text', !/\bdemo\b/.test(text));

  console.log('\n== E3. Keyboard-only navigation ==');
  // tab order inside the utility shell: logo → settings gear
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(60);
  await page.locator('.app-logo').focus();
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() =>
    (document.activeElement && document.activeElement.className) || '');
  ok('E3a Tab order: logo → settings gear', firstFocus.includes('app-settings-btn'), firstFocus);
  // Enter on focused bottom-nav ENGINE item navigates
  await page.locator('.app-nav-item[data-screen="generator"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  ok('E3b Enter on focused nav item activates it',
    await page.evaluate(() => document.getElementById('screen-generator').classList.contains('active')));
  // source parity: the a11y binder covers settings + library controls only —
  // engine cards stay mouse-activated exactly as in the source (documented).
  ok('E3c\u2032 engine cards have no keyboard binding (source parity, documented)',
    await page.evaluate(() => {
      const card = document.querySelector('[data-action="open-engine-subpage"]');
      return !card.hasAttribute('tabindex') && !card.hasAttribute('role');
    }));
  // keyboard activation on a bound control: library sort button opens the sheet
  await page.evaluate(() => window.showScreen('library'));
  await page.waitForTimeout(80);
  await page.locator('[data-action="open-filter-sheet"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  ok('E3c bound library control opens sheet via keyboard',
    await page.evaluate(() => document.getElementById('filterSheet').classList.contains('show')));
  await page.keyboard.press('Escape'); // sheet not search — plain close via backdrop click
  await page.evaluate(() => document.getElementById('backdrop').click());
  await page.waitForTimeout(80);

  console.log('\n== E4. Reduced-motion accessibility (payload + app) ==');
  const rmPage = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await rmPage.emulateMedia({ reducedMotion: 'reduce' });
  const APP_ORIGIN_R = INDEX.startsWith('http') ? new URL(INDEX).origin : INDEX.slice(0, 6);
  await rmPage.route('**/*', r => r.request().url().startsWith(APP_ORIGIN_R) ? r.continue() : r.abort());
  await rmPage.goto(INDEX);
  await rmPage.waitForTimeout(500);
  await rmPage.evaluate(() => window.showScreen('onetouch'));
  await rmPage.waitForTimeout(700);
  ok('E4a One Touch mounts under prefers-reduced-motion',
    await rmPage.evaluate(() => {
      const h = document.getElementById('oneTouchVPN');
      const body = h.shadowRoot && h.shadowRoot.querySelector('.vpn-body');
      return !!body && body.dataset.state === 'disconnected';
    }));
  await rmPage.evaluate(() => window.showScreen('library'));
  await rmPage.waitForTimeout(100);
  ok('E4b app navigates cleanly under reduced motion',
    await rmPage.evaluate(() => document.getElementById('screen-library').classList.contains('active')));
  await rmPage.close();

  console.log('\n== E5. Responsive floor (360px, source media query) ==');
  const smallPage = await browser.newPage({ viewport: { width: 360, height: 740 } });
  const APP_ORIGIN_S = INDEX.startsWith('http') ? new URL(INDEX).origin : INDEX.slice(0, 6);
  await smallPage.route('**/*', r => r.request().url().startsWith(APP_ORIGIN_S) ? r.continue() : r.abort());
  await smallPage.goto(INDEX);
  await smallPage.waitForTimeout(500);
  ok('E5a no horizontal overflow at 360px (dashboard)',
    await smallPage.evaluate(() => document.documentElement.scrollWidth <= 360));
  await smallPage.evaluate(() => window.showScreen('help'));
  await smallPage.waitForTimeout(150);
  ok('E5b helpcenter opens at 360px (source 360px query applies)',
    await smallPage.evaluate(() => document.getElementById('page-helpcenter').classList.contains('open')));
  ok('E5c no horizontal overflow at 360px (helpcenter)',
    await smallPage.evaluate(() => document.documentElement.scrollWidth <= 360));
  await smallPage.evaluate(() => window.showScreen('library'));
  await smallPage.waitForTimeout(120);
  ok('E5d library renders at 360px without overflow',
    await smallPage.evaluate(() => document.documentElement.scrollWidth <= 360));
  await smallPage.close();

  console.log('\n== E6. Console audit (instrumented context) ==');
  ok('E6 zero console errors across edge session', consoleErrors.length === 0,
    consoleErrors.slice(0, 4).join(' | '));

  await page.close();
  await browser.close();
  console.log(`\n==== EDGE RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
})().catch(e => { console.error('EDGE HARNESS ERROR:', e); process.exit(2); });
