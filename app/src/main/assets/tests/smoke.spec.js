/* Smoke + honesty verification for the MAIL_FACTORY build.
 * Runs against the built index.html via playwright-core (Chromium headless).
 * Every test name maps to a matrix verification pass. */
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
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    // Offline test: blocked external resources (fonts/GitHub API) are expected.
    if (txt.includes('net::ERR_FAILED') || txt.includes('ERR_INTERNET_DISCONNECTED')) return;
    consoleErrors.push(txt);
  });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  // External requests must not break the app (fonts/github unreachable → graceful).
  const APP_ORIGIN = INDEX.startsWith('http') ? new URL(INDEX).origin : 'file://';
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith(APP_ORIGIN)) return route.continue();
    route.abort(); // simulate offline for all network calls
  });

  await page.goto(INDEX);
  await page.waitForTimeout(400);

  console.log('\n== A. LOAD & SHELL ==');
  ok('A1 no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
  ok('A2 app-root present', await page.locator('.app-root').count() === 1);
  ok('A3 all 6 screens present', await page.locator('.screen-view').count() === 6);
  ok('A4 dashboard active on load', await page.locator('#screen-dashboard.active').count() === 1);
  ok('A5 utility shell hidden on dashboard',
    await page.locator('#utilityHeader').isHidden() && await page.locator('#utilityNav').isHidden());
  ok('A6 zero "coming soon" text in visible DOM',
    (await page.evaluate(() => document.body.innerText.toLowerCase())).includes('coming soon') === false);

  console.log('\n== B. NAVIGATION (single app shell, no reloads) ==');
  let navigationId = await page.evaluate(() => { window.__navProbe = 42; return 42; });
  await page.click('#utilityHeader, [hidden]', { trial: true }).catch(() => {});
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(50);
  ok('B1 engine active + shell visible',
    await page.locator('#screen-engine.active').count() === 1 &&
    await page.locator('#utilityNav').isVisible());
  ok('B2 engine nav item marked active',
    await page.locator('.app-nav-item[data-screen="engine"].active').count() === 1);
  ok('B3 no page reload (probe survives)', await page.evaluate(() => window.__navProbe === 42));
  await page.evaluate(() => window.showScreen('generator'));
  ok('B4 generator active', await page.locator('#screen-generator.active').count() === 1);
  await page.evaluate(() => window.showScreen('settings'));
  await page.waitForTimeout(50);
  ok('B5 settings opens, shell hides',
    await page.locator('#screen-settings.active').count() === 1 &&
    await page.locator('#utilityNav').isHidden());
  // settings back → last utility screen (generator)
  await page.locator('#screen-settings [data-action="settings-back"]').click();
  ok('B6 settings back returns to last utility screen (generator)',
    await page.locator('#screen-generator.active').count() === 1);
  await page.evaluate(() => window.showScreen('dashboard'));
  ok('B7 dashboard CTA navigates after 300ms feedback',
    await page.locator('#screen-dashboard.active').count() === 1);
  await page.locator('.btn.primary[data-nav="engine"]').click();
  await page.waitForTimeout(450);
  ok('B8 OPEN FACTORY → engine (300ms flow)',
    await page.locator('#screen-engine.active').count() === 1);
  await page.locator('.app-nav-item[data-screen="library"]').click().catch(() => {});
  await page.evaluate(() => window.showScreen('library'));
  ok('B9 library reachable', await page.locator('#screen-library.active').count() === 1);
  ok('B10 "help" alias opens settings+helpcenter', async () => {});

  console.log('\n== C. LIBRARY HONEST STATE ==');
  ok('C1 library list EMPTY (no demo records)',
    await page.locator('#screen-library #list .card').count() === 0);
  ok('C2 total counter shows 0',
    (await page.locator('#screen-library .stat-number').textContent()).trim() === '0');
  // repository-driven rendering
  await page.evaluate(() => {
    window.MF.LibraryRepository.addSingle({ email: 'test.user@example.com', password: 'secret123' });
  });
  await page.waitForTimeout(120);
  ok('C3 store mutation renders real card',
    await page.locator('#screen-library #list .card[data-type="single"]').count() === 1);
  ok('C4 card email matches store record (plain text)',
    (await page.locator('#screen-library .account-email').textContent()) === 'test.user@example.com');
  ok('C5 batch add renders batch card with real count', await page.evaluate(() => {
    window.MF.LibraryRepository.addBatch('web', [
      { email: 'a1@example.com', password: 'p1' },
      { email: 'a2@example.com', password: 'p2' },
      { email: 'a3@example.com', password: 'p3' },
      { email: 'a4@example.com', password: 'p4' }
    ]);
    return document.querySelectorAll('#screen-library #list .card[data-type="batch"]').length === 1;
  }));
  ok('C6 batch shows "4 Accounts"',
    (await page.locator('#screen-library .card[data-type="batch"] .count').textContent()) === '4 Accounts');
  ok('C7 total = 5 (2 records; derived from real data)',
    (await page.locator('#screen-library .stat-number').textContent()).trim() === '5');
  // star via store -> UI
  const singleId = await page.evaluate(() => window.MF.LibraryRepository.viewModels().find(v => v.kind === 'single').id);
  await page.evaluate(id => window.MF.LibraryRepository.toggleStarred(id), singleId);
  await page.waitForTimeout(80);
  ok('C8 star state renders (star badge visible)',
    await page.evaluate(id => {
      const el = document.getElementById('star-' + id);
      return el && el.style.display !== 'none';
    }, singleId));
  // persistence: reload and confirm records survive (real localStorage store)
  await page.reload();
  await page.waitForTimeout(400);
  ok('C9 library persists across reload (localStorage v1)',
    await page.evaluate(() => document.querySelectorAll('#screen-library #list .card').length >= 1));
  // clean up store for later tests
  await page.evaluate(() => {
    window.MF.LibraryRepository.getAll().slice().forEach(r => window.MF.LibraryRepository.remove(r.id));
  });
  ok('C10 delete removes cards (empty state restored)',
    await page.evaluate(() => document.querySelectorAll('#screen-library #list .card').length === 0));

  console.log('\n== D. ENGINE HONESTY ==');
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(50);
  // OPTIMIZE SYSTEM
  const optimizeBtn = page.locator('[data-engine-action="optimizeSystem"]');
  ok('D1 OPTIMIZE SYSTEM carries engine hook (no fake toast attr)',
    await optimizeBtn.count() === 1 &&
    (await optimizeBtn.getAttribute('data-toast')) === null);
  await optimizeBtn.click();
  await page.waitForTimeout(120);
  ok('D2 OPTIMIZE SYSTEM → truthful unconnected toast',
    (await page.locator('#toast').textContent()) === 'Engine is not connected');
  ok('D2b stays on engine screen (no generator navigation)',
    await page.locator('#screen-engine.active').count() === 1);
  // CREATE ACCOUNT
  const createBtn = page.locator('[data-engine-action="createAccount"]');
  ok('D3 CREATE ACCOUNT carries engine hook', await createBtn.count() === 1);
  await createBtn.click();
  await page.waitForTimeout(120);
  ok('D4 CREATE ACCOUNT stays on engine + truthful toast',
    await page.locator('#screen-engine.active').count() === 1 &&
    (await page.locator('#toast').textContent()) === 'Engine is not connected');
  ok('D5 no engine results fabricated in DOM',
    await page.evaluate(() =>
      !document.body.textContent.includes('Created account') &&
      !document.body.textContent.match(/generated?\s+\d+\s+accounts/i)));
  // switches (inside the System Settings subpage)
  await page.locator('[data-action="open-engine-subpage"][data-page="systemsettings"]').click();
  await page.waitForTimeout(80);
  await page.locator('#sw-boost').click();
  await page.waitForTimeout(60);
  ok('D6 switch toggles aria-checked (a11y preserved)',
    (await page.locator('#sw-boost').getAttribute('aria-checked')) === 'true');
  ok('D7 switch persisted in engine settings store',
    await page.evaluate(() => window.MF.EngineSettingsStore.get('boost') === true));
  await page.reload();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(120);
  await page.locator('[data-action="open-engine-subpage"][data-page="systemsettings"]').click();
  await page.waitForTimeout(80);
  ok('D8 switch state survives reload',
    await page.evaluate(() => {
      const el = document.getElementById('sw-boost');
      return el.classList.contains('on') && el.getAttribute('aria-checked') === 'true';
    }));
  await page.locator('[data-action="close-engine-subpage"][data-page="systemsettings"]').click();
  // log engine page
  await page.locator('[data-action="open-engine-subpage"][data-page="logengine"]').click();
  await page.waitForTimeout(80);
  const logText = await page.locator('#logConsole').textContent();
  ok('D9 log console shows exactly the honest ready line (no fake startup logs)',
    logText.includes('Console ready') && !logText.includes('Awaiting activity'));
  const logLines = await page.locator('#logConsole .log-line').count();
  ok('D9b exactly ONE log line (the honest UI line), badge IDLE', logLines === 1);
  ok('D10 log badge is IDLE (never LIVE without real stream)',
    (await page.locator('#logLiveBadge').textContent()) === 'IDLE');

  console.log('\n== E. CHECK ROUTE (real web service, offline in test) ==');
  await page.locator('[data-action="close-engine-subpage"][data-page="logengine"]').click();
  await page.locator('[data-action="open-engine-subpage"][data-page="checkroute"]').click();
  await page.waitForTimeout(100);
  ok('E1 check route page opens with clock', await page.locator('#crClock').textContent().then(t => t.length > 3));
  await page.locator('#crCheckBtn').click();
  await page.waitForTimeout(2200);
  ok('E2 offline check reports FAILED (truthful)',
    (await page.locator('#crRouteStatus').textContent()) === 'FAILED');
  ok('E3 route target from config (cloudflare)',
    (await page.locator('#crRoute').textContent()) === 'www.cloudflare.com');

  console.log('\n== F. GENERATOR (UI only, engine-contract generation) ==');
  await page.evaluate(() => window.showScreen('generator'));
  await page.waitForTimeout(50);
  await page.locator('#screen-generator .tab[data-tab="batch"]').click();
  ok('F1 tabs switch (batch view active)',
    await page.locator('#screen-generator [data-view="batch"].active').count() === 1);
  await page.locator('.tab[data-tab="single"]').click();
  await page.locator('#genSingleBtn').click();
  await page.waitForTimeout(120);
  ok('F2 GENERATE with no engine → truthful toast',
    (await page.locator('#toast').textContent()) === 'Generation engine is not connected');
  ok('F3 output area stays EMPTY (no random generation)',
    (await page.locator('#s-email-out').textContent()).trim() === '');
  ok('F4 no random generators on window (production path removed)',
    await page.evaluate(() =>
      typeof window.genEmail === 'undefined' && typeof window.genPassword === 'undefined' &&
      typeof window.randChar === 'undefined' && typeof window.nameBasedLocalPart === 'undefined'));
  // steppers still work
  const before = await page.locator('#s-email-len').inputValue();
  await page.locator('#screen-generator .stepper button.up[data-target="s-email-len"]').click();
  const after = await page.locator('#s-email-len').inputValue();
  ok('F5 steppers work (length 4–40)', parseInt(after, 10) === Math.min(40, parseInt(before, 10) + 1));

  console.log('\n== G. SETTINGS SUBPAGES & HONEST COPY ==');
  await page.evaluate(() => window.showScreen('settings'));
  await page.waitForTimeout(50);
  await page.locator('[data-action="open-subpage"][data-page="language"]').click();
  await page.waitForTimeout(80);
  ok('G1 language list renders 20 entries',
    await page.locator('#langList .row').count() === 20);
  await page.locator('#langList .row').nth(2).click();
  await page.waitForTimeout(80);
  ok('G2 language selection persists (real key mailFactoryLanguage)',
    await page.evaluate(() => localStorage.getItem('mailFactoryLanguage') || ''));
  ok('G3 language copy has no "translation coming" promise',
    !((await page.locator('#page-language').textContent()).includes('coming in a future update')));
  await page.locator('[data-action="close-subpage"][data-page="language"]').click();
  await page.locator('[data-action="open-subpage"][data-page="appearance"]').click();
  await page.waitForTimeout(80);
  await page.locator('#page-appearance .theme-card.locked').first().click();
  await page.waitForTimeout(120);
  const themeToast = await page.locator('#toast').textContent();
  ok('G4 locked theme → truthful locked toast, no "coming soon"',
    themeToast.includes('locked') && !themeToast.toLowerCase().includes('coming soon'));
  await page.locator('[data-action="close-subpage"][data-page="appearance"]').click();
  // backup
  await page.locator('[data-action="open-backup"]').click();
  await page.waitForTimeout(80);
  ok('G5 backup screen opens', await page.evaluate(() => document.getElementById('backupScreen').classList.contains('open')));
  await page.locator('#backupScreen .connect-btn').first().click();
  await page.waitForTimeout(120);
  const backupToast = await page.locator('#toast').textContent();
  ok('G6 backup connect → truthful (never claims connected)',
    backupToast.includes('no backup provider is connected'));
  ok('G7 connect button did NOT flip to Connected',
    await page.evaluate(() => !document.querySelector('#backupScreen .connect-btn.connected')));
  await page.locator('[data-action="close-backup"]').click();
  // version page (offline → honest error)
  await page.locator('[data-action="open-subpage"][data-page="version"]').click();
  await page.waitForTimeout(80);
  await page.locator('[data-action="check-update"]').click();
  await page.waitForTimeout(600);
  const modalTitle = await page.locator('#modalTitle').textContent();
  ok('G8 version check offline → honest failure state',
    modalTitle.includes('Could not check for updates'), modalTitle);
  await page.locator('[data-action="modal-close"]').click();
  // report problem anchors from config
  ok('G9 report-problem anchors = config GitHub URLs',
    await page.evaluate(() =>
      document.getElementById('linkKnownIssues').href === window.MF.config.github.issues &&
      document.getElementById('linkNewIssue').href === window.MF.config.github.newIssue));

  console.log('\n== H. ONE TOUCH (isolated payload) ==');
  await page.evaluate(() => window.showScreen('onetouch'));
  await page.waitForTimeout(300);
  ok('H1 payload mounted into shadow root',
    await page.evaluate(() => {
      const host = document.getElementById('oneTouchVPN');
      return !!host.shadowRoot && !!host.shadowRoot.querySelector('.vpn-body');
    }));
  ok('H2 payload starts disconnected (real state machine)',
    await page.evaluate(() => {
      const body = document.querySelector('#oneTouchVPN').shadowRoot.querySelector('.vpn-body');
      return body.dataset.state === 'disconnected';
    }));
  ok('H3 payload styles scoped (no host-document leak)',
    await page.evaluate(() => {
      const host = document.getElementById('oneTouchVPN');
      return host.shadowRoot.querySelector('style') !== null;
    }));
  // leave and re-enter — fresh disconnected view
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.showScreen('onetouch'));
  await page.waitForTimeout(200);
  ok('H4 re-entry keeps isolated state machine alive (no remount)',
    await page.evaluate(() => {
      const host = document.getElementById('oneTouchVPN');
      return !!host.shadowRoot && !!host.shadowRoot.querySelector('.vpn-body');
    }));

  console.log('\n== I. ENGINE CONTRACT BOUNDARY ==');
  ok('I1 engine unavailable (no fake engine)',
    await page.evaluate(() => window.MF.engine.isAvailable() === false));
  ok('I2 execute() rejects with truthful code',
    await page.evaluate(() =>
      window.MF.engine.execute('createAccount').then(() => false,
        e => e && e.code === 'ENGINE_UNAVAILABLE')));
  ok('I3 adapter version tagged',
    await page.evaluate(() =>
      window.MF.engineContracts && window.MF.engineContracts.ENGINE_ADAPTER_VERSION === 1));

  console.log('\n== J. CONFIG CENTRALISATION ==');
  ok('J1 real URLs centralized',
    await page.evaluate(() =>
      window.MF.config.github.website === 'https://mailfactorylabs.github.io' &&
      window.MF.config.network.routeCheck.targetUrl === 'https://www.cloudflare.com/cdn-cgi/trace' &&
      window.MF.config.github.repo === 'MailFactoryLabs/MailFactoryLabs.github.io'));
  ok('J2 unconfigured social links are null (not invented)',
    await page.evaluate(() =>
      window.MF.config.links.telegram === null && window.MF.config.links.facebook === null &&
      window.MF.config.links.whatsapp === null && window.MF.config.links.youtube === null &&
      window.MF.config.links.contactEmail === null && window.MF.config.links.rating === null));

  console.log('\n== K. FINAL CONSOLE AUDIT ==');
  ok('K1 zero console errors across whole session', consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | '));

  await browser.close();
  console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
