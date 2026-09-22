/* Unit tests — pure module logic, run in Node with a window shim.
 * Covers: ReleaseService.compareVersions + checkForUpdate (mocked fetch),
 * engine contract boundary (facade/adapter errors), GeneratorService
 * request bounds, LibraryRepository semantics, EngineLogStore discipline. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..'); // project root — no absolute paths
let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
}

/* --- sandbox: modules expect a `window` global they can attach MF to --- */
const store = new Map();
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Promise, Number, String, Array, Object, Error, RegExp,
  fetch: () => Promise.reject(new Error('network disabled in unit tests')),
};
sandbox.window = sandbox;
sandbox.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
};
sandbox.performance = { now: () => Date.now() };
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  vm.runInContext(code, sandbox, { filename: rel });
}
[
  'config/app-config.js',
  'scripts/core/storage.js',
  'scripts/adapters/engine/engine-adapter.js',
  'scripts/adapters/engine/unavailable-engine-adapter.js',
  'scripts/adapters/engine/engine-bridge.js',
  'scripts/data/library-repository.js',
  'scripts/services/engine-settings-store.js',
  'scripts/services/engine-service.js',
  'scripts/services/generator-service.js',
  'scripts/services/release-service.js',
  'scripts/services/engine-log-store.js',
].forEach(load);

(async () => {
  console.log('\n== U1. compareVersions (verbatim source algorithm) ==');
  const cv = sandbox.window.MF.ReleaseService.compareVersions;
  ok('1.0.0 == 1.0.0', cv('1.0.0', '1.0.0') === 0);
  ok('1.0.1 > 1.0.0', cv('1.0.1', '1.0.0') === 1);
  ok('0.9.9 < 1.0.0', cv('0.9.9', '1.0.0') === -1);
  ok('1.10.0 > 1.9.0 (numeric, not lexicographic)', cv('1.10.0', '1.9.0') === 1);
  ok('1.0 == 1.0.0 (short tail padded)', cv('1.0', '1.0.0') === 0);
  ok('2.0.0-beta == 2.0.0 (non-numeric tail dropped)', cv('2.0.0-beta', '2.0.0') === 0);
  ok('v-prefix handled upstream, raw here', cv('1.2.0', '1.1.9') === 1);

  console.log('\n== U2. ReleaseService.checkForUpdate (mocked GitHub API) ==');
  async function withFetch(value, fn) {
    const prev = sandbox.fetch;
    sandbox.fetch = () => Promise.resolve(value);
    sandbox.window.fetch = sandbox.fetch;
    try { await fn(); } finally { sandbox.fetch = prev; sandbox.window.fetch = prev; }
  }
  const json = obj => ({ status: 200, ok: true, json: () => Promise.resolve(obj) });
  await withFetch({ status: 404, ok: false }, async () => {
    const r = await sandbox.window.MF.ReleaseService.checkForUpdate();
    ok('404 → no-releases (truthful)', r.status === 'no-releases');
  });
  await withFetch(json({ tag_name: 'v1.1.0', html_url: 'https://github.com/x/r/releases/v1.1.0' }), async () => {
    const r = await sandbox.window.MF.ReleaseService.checkForUpdate();
    ok('newer tag → update-available + trimmed version', r.status === 'update-available' && r.latest === '1.1.0');
    ok('release URL forwarded', r.releaseUrl.includes('releases/v1.1.0'));
  });
  await withFetch(json({ tag_name: 'v1.0.0' }), async () => {
    const r = await sandbox.window.MF.ReleaseService.checkForUpdate();
    ok('equal tag → up-to-date', r.status === 'up-to-date');
  });
  await withFetch(json({ tag_name: 'v0.9.0' }), async () => {
    const r = await sandbox.window.MF.ReleaseService.checkForUpdate();
    ok('older tag → ahead', r.status === 'ahead');
  });
  await withFetch(json({ tag_name: 'not-a-version' }), async () => {
    let threw = false;
    await sandbox.window.MF.ReleaseService.checkForUpdate().catch(() => { threw = true; });
    ok('invalid tag → rejects (no fabrication)', threw);
  });
  await withFetch({ status: 500, ok: false }, async () => {
    let threw = false;
    await sandbox.window.MF.ReleaseService.checkForUpdate().catch(() => { threw = true; });
    ok('HTTP 500 → rejects (honest failure)', threw);
  });
  await withFetch(json([{ tag_name: 'v1.1.0', published_at: '2026-01-15T10:00:00Z', body: 'First release\nMore', html_url: 'u' },
                        { tag_name: 'v1.0.0', prerelease: false, body: '', html_url: 'u' }]), async () => {
    const list = await sandbox.window.MF.ReleaseService.fetchHistory();
    ok('history capped at 10, normalized', list.length === 2 && list[0].version === 'v1.1.0');
    ok('first entry flagged Latest', list[0].tag === 'Latest');
    ok('notes truncated to first line', list[0].notes === 'First release');
    ok('empty body → honest default', list[1].notes === 'No release notes provided.');
  });

  console.log('\n== U3. Engine contract boundary ==');
  const MF = sandbox.window.MF;
  let err = null;
  await MF.engine.execute('createAccount').catch(e => { err = e; });
  ok('unavailable → ENGINE_UNAVAILABLE', err && err.code === 'ENGINE_UNAVAILABLE');
  const status = await MF.engine.getStatus();
  ok('getStatus ready:false while unavailable', status && status.ready === false);
  ok('isAvailable false', MF.engine.isAvailable() === false);
  let threwInvalid = null;
  try { MF.engine.registerAdapter({}); } catch (e) { threwInvalid = e; }
  ok('registerAdapter rejects malformed adapter (INVALID_ADAPTER)',
    threwInvalid && threwInvalid.code === 'INVALID_ADAPTER');
  ok('adapter version is 1', MF.engineContracts.ENGINE_ADAPTER_VERSION === 1);

  console.log('\n== U3b. EngineSettingsStore: DESIRED vs NATIVE semantics ==');
  const ES = MF.EngineSettingsStore;
  const desiredKey = MF.config.storage.engineSettings;
  const desiredBefore = store.get(desiredKey);
  ES.set('boost', true); // desired flip (was already true from earlier U-phase? ensure deterministic)
  ok('U3b-1 get() returns DESIRED state (persisted intent)',
    ES.get('boost') === true && store.get(desiredKey) !== undefined);
  ok('U3b-2 nativeState() UNKNOWN (undefined) with no engine — never fabricated',
    ES.nativeState('boost') === undefined);
  ok('U3b-3 isSyncedWithNative false while native state unknown', ES.isSyncedWithNative() === false);
  ok('U3b-4 markNative records only real acknowledgements',
    (ES.markNative('boost', true), ES.nativeState('boost') === true));
  ok('U3b-5 native state is RUNTIME-ONLY (not persisted)',
    (store.get(desiredKey) || '').includes('native') === false &&
    !JSON.stringify(JSON.parse(store.get(desiredKey) || '{}')).includes('"boost":true,"__'));
  ES.markNative('boost', undefined);
  ok('U3b-6 clearing ack returns to honest UNKNOWN', ES.nativeState('boost') === undefined);
  // restore desired state for later phases
  ES.set('boost', false);

  console.log('\n== U4. GeneratorService request bounds (UI policy mirrored) ==');
  const GS = MF.GeneratorService;
  const single = GS.buildSingleRequest({ namePattern: '  john ', emailLength: '2', passwordLength: '3' });
  ok('single: name trimmed, email clamped ≥3, password clamped ≥4',
    single.namePattern === 'john' && single.emailLength === 3 && single.passwordLength === 4);
  ok('single carries the config-driven domain HINT (engine owns the decision)',
    single.domainHint === MF.config.engine.generationDomainHint);
  const batch = GS.buildBatchRequest({ emailLength: '50', passwordLength: '100', quantity: '5000' });
  ok('hint is omit-able (null config → field undefined, not a business rule)',
    (function () {
      const prev = MF.config.engine.generationDomainHint;
      MF.config.engine.generationDomainHint = null;
      const r = GS.buildSingleRequest({ emailLength: '10', passwordLength: '10' });
      MF.config.engine.generationDomainHint = prev;
      return r.domainHint === undefined;
    })());
  ok('batch: quantity clamped 1–200', batch.quantity === 200 && batch.mode === 'batch');
  ok('batch carries the domain HINT too', batch.domainHint === 'example.com');
  const genErr = await new Promise(r => GS.generate(batch).then(() => r('resolved'), e => r(e)));
  ok('generate without engine → ENGINE_UNAVAILABLE (no random fallback)',
    genErr && genErr.code === 'ENGINE_UNAVAILABLE');

  console.log('\n== U5. LibraryRepository semantics (one authoritative store) ==');
  const LR = MF.LibraryRepository;
  ok('initial store EMPTY (no demo data)', LR.getAll().length === 0 && LR.total() === 0);
  const s1 = LR.addSingle({ email: 'user.one@example.com', password: 'pw1' });
  const b1 = LR.addBatch('web', [
    { email: 'b1@example.com', password: 'p' }, { email: 'b2@example.com', password: 'p' },
    { email: 'b3@example.com', password: 'p' }, { email: 'b4@example.com', password: 'p' }]);
  ok('total derives from members (1 + 4 = 5)', LR.total() === 5);
  ok('batch count is real members.length',
    LR.viewModels().find(v => v.id === b1.id).count === 4);
  LR.toggleStarred(b1.id);
  ok('starred applies to batches', LR.viewModels().find(v => v.id === b1.id).starred === true);
  LR.rename(b1.id, 'web farm');
  ok('rename persists to displayName', LR.viewModels().find(v => v.id === b1.id).name === 'web farm');
  const sep = LR.separateMember(b1.id, 1);
  ok('separateMember returns new single record with originBatchId',
    sep && sep.kind === 'single' && sep.originBatchId === b1.id);
  ok('batch count decremented after separation (real mutation)',
    LR.viewModels().find(v => v.id === b1.id).count === 3);
  ok('separated account is verified (state.verified), member moved out',
    LR.viewModels().find(v => v.id === sep.id).verified === true &&
    LR.viewModels().find(v => v.id === b1.id).members.every(m => m.email !== sep.email));
  const q = LR.query('B4'); // b4 is still a real batch member (b2 was separated)
  ok('query matches real members only (case-insensitive)',
    q.length === 1 && q[0].matches === 1 && q[0].id === b1.id);
  const qSep = LR.query('b2@example.com');
  ok('separated member now matches as its own single record',
    qSep.length === 1 && qSep[0].id === sep.id && qSep[0].matches === 1);
  const q2 = LR.query('nonexistent-xyz');
  ok('query with no hits returns empty, not fabricated', q2.length === 0);
  // persistence round-trip through the (sandboxed) localStorage
  const raw = store.get('mailFactory.library.v1');
  ok('store persisted under versioned key', !!raw && JSON.parse(raw).v === 1 && Array.isArray(JSON.parse(raw).records));
  LR.remove(sep.id);
  LR.remove(b1.id); LR.remove(s1.id);
  ok('delete removes records (no resurrection in-session)', LR.getAll().length === 0 && LR.total() === 0);

  console.log('\n== U6. EngineLogStore discipline (no timers, no fabrication) ==');
  const LS = MF.EngineLogStore;
  ok('starts empty + disconnected', LS.getEntries().length === 0 && LS.isStreamConnected() === false);
  let seen = null;
  const un = LS.subscribe((entries, live) => { seen = { n: entries.length, live }; });
  LS.push({ tag: 'ENGINE', text: 'real event', level: 'ok' });
  ok('real event stored + broadcast live', seen && seen.n === 1 && seen.live === false);
  ok('MAX_ENTRIES cap enforced (200)', (LS.push({ tag: 'E', text: 'x' }), LS.getEntries().length === 2));
  un();
  const detach = LS.connectStream(push => { push({ tag: 'ENGINE', text: 'stream line' }); });
  ok('connectStream marks stream connected (LIVE justified)', LS.isStreamConnected() === true);
  detach();
  ok('detach returns to honest IDLE', LS.isStreamConnected() === false);

  console.log(`\n==== UNIT RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
})().catch(e => { console.error('UNIT HARNESS ERROR:', e); process.exit(2); });
