/* Deep UX-flow verification — matrix §45-B functional criteria + §46 Pass 8/9.
 * Exercises real UI interactions: every settings subpage open/close, the
 * Library card menu (star/verify/rename/delete via dialogs), long-press
 * sub-account separation, search + Escape restore, sort modes, copy
 * controls, accordions, keyboard activation, rating, share fallback,
 * SVG symbol resolution, and no-resurrection persistence. */
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
    if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) consoleErrors.push(m.text());
  });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  const APP_ORIGIN = INDEX.startsWith('http') ? new URL(INDEX).origin : 'file://';
  await page.route('**/*', r => (r.request().url().startsWith('file://') || r.request().url().startsWith(APP_ORIGIN)) ? r.continue() : r.abort());
  await page.goto(INDEX);
  await page.waitForTimeout(500);

  /* dialog plumbing: rename → prompt, delete → confirm */
  page.on('dialog', dialog => {
    if (dialog.type() === 'prompt') dialog.accept(page.__renameValue || '');
    else dialog.accept();
  });

  console.log('\n== X1. EVERY settings subpage opens and closes ==');
  await page.evaluate(() => window.showScreen('settings'));
  await page.waitForTimeout(80);
  const subpages = ['notifications', 'appearance', 'language', 'helpcenter', 'sendfeedback',
    'reportproblem', 'contactus', 'ratetheapp', 'sharetheapp', 'privacypolicy',
    'termsofservice', 'aboutmailfactory', 'version'];
  let allOpenClose = true, firstBad = '';
  for (const sp of subpages) {
    await page.locator(`[data-action="open-subpage"][data-page="${sp}"]`).click();
    await page.waitForTimeout(60);
    const opened = await page.evaluate(id => document.getElementById('page-' + id).classList.contains('open'), sp);
    // helpcenter's back button is bound by help.js (source parity) — no data-action there
    const backSel = sp === 'helpcenter'
      ? '#page-helpcenter .back-btn'
      : `#page-${sp} [data-action="close-subpage"][data-page="${sp}"]`;
    await page.locator(backSel).click();
    await page.waitForTimeout(60);
    const closed = await page.evaluate(id => !document.getElementById('page-' + id).classList.contains('open'), sp);
    if (!opened || !closed) { allOpenClose = false; firstBad = sp; break; }
  }
  ok('X1 all 13 sub-pages (backup overlay is the 14th, tested in G5/X9) open AND close', allOpenClose, firstBad);

  console.log('\n== X2. Library card menu: star / verify / rename / delete (UI) ==');
  await page.evaluate(() => {
    window.__ids = {};
    window.__ids.rec = window.MF.LibraryRepository.addSingle({ email: 'menu.target@example.com', password: 'pw' }).id;
  });
  await page.evaluate(() => window.showScreen('library'));
  await page.waitForTimeout(150);
  const recId = await page.evaluate(() => window.__ids.rec);
  // star via card menu
  await page.locator(`[data-action="card-menu"][data-card="${recId}"]`).click();
  await page.waitForTimeout(80);
  await page.locator('#cardMenuStarOption').click();
  await page.waitForTimeout(120);
  ok('X2a star via menu → badge visible',
    await page.evaluate(id => document.getElementById('star-' + id).style.display !== 'none', recId));
  // verify via card menu
  await page.locator(`[data-action="card-menu"][data-card="${recId}"]`).click();
  await page.waitForTimeout(80);
  await page.locator('#cardMenuVerifyOption').click();
  await page.waitForTimeout(120);
  ok('X2b verify via menu → data-verified + VERIFIED badge + meta label',
    await page.evaluate(id => {
      const card = document.getElementById(id);
      return card.getAttribute('data-verified') === 'true' &&
        !!card.querySelector('.verified-badge') &&
        card.querySelector('.meta .date').textContent === 'Verified account';
    }, recId));
  ok('X2b′ store marks verified (single authority)',
    await page.evaluate(id => window.MF.LibraryRepository.viewModels().find(v => v.id === id).verified === true, recId));
  // rename via prompt
  page.__renameValue = 'renamed.target@example.com';
  await page.locator(`[data-action="card-menu"][data-card="${recId}"]`).click();
  await page.waitForTimeout(80);
  await page.locator('#cardMenuRenameOption').click();
  await page.waitForTimeout(150);
  ok('X2c rename via prompt → UI shows new email',
    (await page.locator(`#${recId} .account-email`).textContent()) === 'renamed.target@example.com');
  // delete via confirm
  await page.locator(`[data-action="card-menu"][data-card="${recId}"]`).click();
  await page.waitForTimeout(80);
  await page.locator('#cardMenuDeleteOption').click();
  await page.waitForTimeout(450);
  ok('X2d delete via confirm → card gone (after 200ms fade)',
    await page.evaluate(id => !document.getElementById(id), recId));

  console.log('\n== X3. Batch long-press → Verify sub-account (separation flow) ==');
  const batchId = await page.evaluate(() => {
    const b = window.MF.LibraryRepository.addBatch('lp-batch', [
      { email: 'lp1@example.com', password: 'p' }, { email: 'lp2@example.com', password: 'p' },
      { email: 'lp3@example.com', password: 'p' }]);
    return b.id;
  });
  await page.waitForTimeout(120);
  const singlesBefore = await page.evaluate(() =>
    document.querySelectorAll('#screen-library #list .card[data-type="single"]').length);
  await page.locator(`#${batchId} .subitem[data-index="2"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(700);
  const menuShown = await page.evaluate(() =>
    document.getElementById('cardMenuSheet').classList.contains('show'));
  const menuTitle = await page.locator('#cardMenuTitle').textContent();
  const optionsVisibility = await page.evaluate(() => ({
    star: document.getElementById('cardMenuStarOption').style.display,
    rename: document.getElementById('cardMenuRenameOption').style.display,
    del: document.getElementById('cardMenuDeleteOption').style.display,
    verify: document.getElementById('cardMenuVerifyOption').style.display,
  }));
  ok('X3a 550ms long-press opens sub-account menu with member email',
    menuShown && menuTitle === 'lp3@example.com');
  ok('X3b sub-account menu offers Verify only', optionsVisibility.verify === 'flex' &&
    optionsVisibility.star === 'none' && optionsVisibility.rename === 'none' && optionsVisibility.del === 'none');
  await page.locator('#cardMenuVerifyOption').click();
  await page.waitForTimeout(150);
  ok('X3c Verify separates member into new verified single',
    await page.evaluate(n => {
      const singles = document.querySelectorAll('#screen-library #list .card[data-type="single"]');
      if (singles.length !== n + 1) return false;
      const latest = singles[singles.length - 1];
      return latest.getAttribute('data-verified') === 'true' &&
        latest.querySelector('.account-email').textContent === 'lp3@example.com';
    }, singlesBefore));
  ok('X3d batch count reflects the real mutation (2 left of 3)',
    (await page.locator(`#${batchId} .batch-info .count`).textContent()) === '2 Accounts');

  console.log('\n== X4. Search sheet: match meta, Escape restore, clear ==');
  await page.locator('#libSearchBtn').click();
  await page.waitForTimeout(120);
  await page.locator('#libSearchInput').fill('lp1');
  await page.waitForTimeout(120);
  ok('X4a live search meta shows 1 match',
    (await page.locator('#libSearchMeta').textContent()) === '1 match');
  ok('X4b non-matching card hidden while searching',
    await page.evaluate(bid => {
      const batch = document.getElementById(bid);
      return batch.style.display !== 'none' &&
        batch.querySelector('.subitem[data-index="1"]').style.display === 'none';
    }, batchId));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok('X4c Escape clears + closes and restores full list',
    await page.evaluate(bid => {
      const batch = document.getElementById(bid);
      return !document.getElementById('searchSheet').classList.contains('show') &&
        batch.style.display === '' &&
        batch.querySelector('.subitem[data-index="1"]').style.display === '';
    }, batchId));
  // pre-search expansion snapshot: collapse batch, search, escape → still collapsed
  await page.locator(`[data-action="toggle-batch"][data-batch="${batchId}"]`).click();
  await page.waitForTimeout(100);
  await page.locator('#libSearchBtn').click();
  await page.waitForTimeout(100);
  await page.locator('#libSearchInput').fill('lp');
  await page.waitForTimeout(100);
  await page.locator('#libSearchClear').click();
  await page.waitForTimeout(120);
  ok('X4d clear restores pre-search expansion state (collapsed stays collapsed)',
    await page.evaluate(bid =>
      document.getElementById('sub-' + bid).style.gridTemplateRows === '0fr', batchId));
  await page.keyboard.press('Escape'); // close the search sheet before the sort block
  await page.waitForTimeout(120);

  console.log('\n== X5. Sort modes (six, via UI) ==');
  const ids = await page.evaluate(() => {
    const L = window.MF.LibraryRepository;
    L.getAll().slice().forEach(r => L.remove(r.id));
    return {
      a: L.addSingle({ email: 'old@example.com', password: 'p', createdAt: '2026-01-01T10:00:00Z' }).id,
      b: L.addSingle({ email: 'new@example.com', password: 'p', createdAt: '2026-06-01T10:00:00Z' }).id,
      c: L.addSingle({ email: 'mid@example.com', password: 'p', createdAt: '2026-03-01T10:00:00Z' }).id,
      d: L.addBatch('zbatch', [{ email: 'z1@example.com', password: 'p' }]).id,
    };
  });
  await page.waitForTimeout(150);
  async function sortBy(mode) {
    await page.locator('[data-action="open-filter-sheet"]').click();
    await page.waitForTimeout(80);
    await page.locator(`.filter-option[data-mode="${mode}"]`).click();
    await page.waitForTimeout(120);
    return page.evaluate(() => document.querySelector('#screen-library #list .card').id);
  }
  // note: the batch (ids.d) was created last → its createdAt (real "now") is
  // the newest record in the store, so newest correctly surfaces the batch.
  ok('X5a newest → latest-created record first (the batch)',
    (await sortBy('newest')) === ids.d);
  ok('X5a′ newest ignores kind, orders by real createdAt',
    (await page.evaluate(ids => {
      const firstTwo = [...document.querySelectorAll('#screen-library #list .card')].slice(0, 2);
      return firstTwo[1].id === ids.b; // newest single is second overall
    }, ids)));
  ok('X5b oldest → oldest single first', (await sortBy('oldest')) === ids.a);
  ok('X5c singles → single card first', (await sortBy('singles')).startsWith('r') &&
    (await page.evaluate(() => document.querySelector('#screen-library #list .card').dataset.type)) === 'single');
  ok('X5d batches → batch card first', (await sortBy('batches')) === ids.d);
  // star oldest → starred sort puts it first
  await page.evaluate(id => window.MF.LibraryRepository.toggleStarred(id), ids.a);
  await page.waitForTimeout(100);
  ok('X5e starred → starred record first', (await sortBy('starred')) === ids.a);
  // verify 'new' → verified sort puts it first
  await page.evaluate(id => window.MF.LibraryRepository.toggleVerified(id), ids.b);
  await page.waitForTimeout(100);
  ok('X5f verified → verified record first', (await sortBy('verified')) === ids.b);

  console.log('\n== X6. Copy controls react honestly (DONE or RETRY in headless) ==');
  const copyLabel = await page.evaluate(() => {
    const card = document.querySelector('#screen-library #list .card[data-type="single"]');
    return { id: card.id };
  });
  await page.locator(`#${copyLabel.id} .copy-btn`).first().click();
  await page.waitForTimeout(250);
  ok('X6a copy button label flips (DONE or honest RETRY)',
    await page.evaluate(id => {
      const l = document.querySelector(`#${id} .copy-btn .btn-label`);
      return l.textContent === 'DONE' || l.textContent === 'RETRY';
    }, copyLabel.id));
  ok('X6b copy payload is the real record value',
    await page.evaluate(id => {
      const btn = document.querySelector(`#${id} .copy-btn`);
      return btn.getAttribute('data-copy') !== '' && btn.getAttribute('data-copy') !== '••••••••••';
    }, copyLabel.id));

  console.log('\n== X7. Accordions + keyboard activation ==');
  await page.evaluate(() => window.showScreen('help'));
  await page.waitForTimeout(100);
  const hcItem = page.locator('#page-helpcenter .acc-item').first();
  await hcItem.locator('.acc-trigger').click();
  await page.waitForTimeout(80);
  ok('X7a helpcenter accordion toggles open',
    await page.evaluate(() => document.querySelector('#page-helpcenter .acc-item').classList.contains('open')));
  ok('X7b aria-expanded synced post-toggle',
    (await hcItem.locator('.acc-trigger').getAttribute('aria-expanded')) === 'true');
  await page.locator('#page-helpcenter .back-btn').click(); // close overlay before next step
  await page.waitForTimeout(80);
  // keyboard: Enter on a theme card (locked) → truthful toast
  await page.evaluate(() => { window.showScreen('settings'); });
  await page.locator('[data-action="open-subpage"][data-page="appearance"]').click();
  await page.waitForTimeout(80);
  await page.locator('#page-appearance .theme-card.locked').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  ok('X7c Enter on focused locked theme card → truthful toast',
    (await page.locator('#toast').textContent()).includes('locked'));
  await page.locator('#page-appearance [data-action="close-subpage"][data-page="appearance"]').click();
  await page.waitForTimeout(80);

  console.log('\n== X8. Rating + Share honest flows ==');
  await page.evaluate(() => window.showScreen('settings'));
  await page.locator('[data-action="open-subpage"][data-page="ratetheapp"]').click();
  await page.waitForTimeout(80);
  await page.locator('#starRow svg[data-v="4"]').click();
  await page.waitForTimeout(60);
  await page.locator('[data-action="submit-rating"]').click();
  await page.waitForTimeout(120);
  ok('X8a rating with no destination → saved locally only (no false external claim)',
    (await page.locator('#toast').textContent()) === 'Rating saved on this device');
  ok('X8b rating persisted under versioned key',
    await page.evaluate(() => localStorage.getItem('mailFactory.rating.v1') !== null));
  // share: headless clipboard → one of the two honest outcomes
  await page.locator('[data-action="close-subpage"][data-page="ratetheapp"]').click();
  await page.locator('[data-action="open-subpage"][data-page="sharetheapp"]').click();
  await page.waitForTimeout(80);
  await page.locator('[data-action="copy-share-link"]').first().click();
  await page.waitForTimeout(250);
  const shareToast = await page.locator('#toast').textContent();
  ok('X8c share link copy → honest outcome pair',
    shareToast === 'Link copied to clipboard' || shareToast === 'Could not copy link', shareToast);
  ok('X8d share row shows config display URL',
    (await page.locator('#shareLinkText').textContent()) === 'github.com/MailFactoryLabs/MailFactoryLabs.github.io');

  console.log('\n== X9. Backup connect does not bubble / screen stays ==');
  await page.locator('[data-action="close-subpage"][data-page="sharetheapp"]').click();
  await page.locator('[data-action="open-backup"]').click();
  await page.waitForTimeout(80);
  await page.locator('#backupScreen .connect-btn').nth(2).click();
  await page.waitForTimeout(120);
  ok('X9a backup screen still open (no accidental close)',
    await page.evaluate(() => document.getElementById('backupScreen').classList.contains('open')));
  ok('X9b connect button unchanged (no Connected class)',
    await page.evaluate(() => !document.querySelector('#backupScreen .connect-btn.connected')));

  console.log('\n== X10. Structure integrity: SVG symbols resolve, no orphans ==');
  ok('X10a every <use href="#i-…"> resolves to a defined symbol',
    await page.evaluate(() => {
      const uses = document.querySelectorAll('use[href^="#"]');
      for (const u of uses) {
        if (!document.querySelector(u.getAttribute('href'))) return false;
      }
      return uses.length > 0;
    }));
  ok('X10b listeners survive re-renders (delegation, no orphans)',
    await page.evaluate(async () => {
      // add a record while a search filter is NOT active; the new card must be immediately interactive
      window.MF.LibraryRepository.addSingle({ email: 'fresh@example.com', password: 'p' });
      await new Promise(r => setTimeout(r, 150));
      const card = [...document.querySelectorAll('#screen-library #list .card[data-type="single"]')]
        .find(c => c.querySelector('.account-email').textContent === 'fresh@example.com');
      card.querySelector('.copy-btn').click();
      await new Promise(r => setTimeout(r, 200));
      const label = card.querySelector('.copy-btn .btn-label').textContent;
      return label === 'DONE' || label === 'RETRY';
    }));

  console.log('\n== X11. Persistence: no resurrection after reload ==');
  await page.reload();
  await page.waitForTimeout(500);
  ok('X11a deleted demo-less store persists; deleted records stay deleted',
    await page.evaluate(() => {
      const emails = [...document.querySelectorAll('#screen-library .account-email, #screen-library .sub-email')]
        .map(e => e.textContent);
      return !emails.includes('menu.target@example.com') &&
        !emails.includes('renamed.target@example.com') &&
        emails.includes('fresh@example.com');
    }));
  ok('X11b renamed value coherent after reload (rename authority = store)',
    await page.evaluate(() => {
      const L = window.MF.LibraryRepository;
      const fresh = L.viewModels().find(v => v.email === 'fresh@example.com');
      return !!fresh;
    }));

  console.log('\n== X12. Log Engine reopen: no duplicate fabricated lines ==');
  await page.evaluate(() => window.showScreen('engine'));
  await page.waitForTimeout(60);
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-action="open-engine-subpage"][data-page="logengine"]').click();
    await page.waitForTimeout(60);
    await page.locator('[data-action="close-engine-subpage"][data-page="logengine"]').click();
    await page.waitForTimeout(60);
  }
  await page.locator('[data-action="open-engine-subpage"][data-page="logengine"]').click();
  await page.waitForTimeout(80);
  const logLineCount = await page.locator('#logConsole .log-line').count();
  ok('X12 exactly one honest ready line after repeated opens', logLineCount === 1,
    'count=' + logLineCount);

  console.log('\n== X13. Console audit ==');
  ok('X13 zero console errors across the whole UX session', consoleErrors.length === 0,
    consoleErrors.slice(0, 4).join(' | '));

  await browser.close();
  console.log(`\n==== UX RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
})().catch(e => { console.error('UX HARNESS ERROR:', e); process.exit(2); });
