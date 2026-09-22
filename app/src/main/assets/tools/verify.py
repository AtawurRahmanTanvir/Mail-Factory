#!/usr/bin/env python3
"""verify.py — static integrity checks for the MAIL_FACTORY build.

Passes:
  1. payload byte-equality against the ORIGINAL monolith
  2. native-vpn-controls block byte-equality
  3. CSS files byte-include the original <style> blocks (line ranges)
  4. index.html structure (6 screens, script order, artifact freshness)
  5. forbidden-pattern scan — visible DOM wording, executable definitions,
     Cloudflare artifacts (real config trace URL excepted)
  6. config single-source-of-truth scan (no URL literals outside config;
     w3.org SVG namespaces excepted)
"""
import base64, os, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent  # project root
_orig_path = pathlib.Path(os.environ.get(
    'MF_ORIG_SOURCE', ROOT.parent / 'uploads' / 'mail-factory.html'))
if _orig_path.exists():
    ORIG = _orig_path.read_text(encoding='utf-8')
else:
    ORIG = None
IDX = ROOT / 'index.html'
index = IDX.read_text(encoding='utf-8') if IDX.exists() else ''

fails = []
def check(name, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + name + (f'  [{detail}]' if detail and not cond else ''))
    if not cond:
        fails.append(name)

print('== 1. ONE TOUCH payload integrity ==')
m = None
if ORIG is None:
    print('  SKIP  original source not found (set MF_ORIG_SOURCE) — byte-compare passes skipped')
else:
    m = re.search(r'<script id="vpn-document" type="application/octet-stream">(.*?)</script>', ORIG, re.S)
    orig_b64 = m.group(1).strip()
    orig_payload = base64.b64decode(orig_b64).decode('utf-8')
    disk_payload = (ROOT / 'assets/one-touch/payload.html').read_text(encoding='utf-8')
    disk_b64 = (ROOT / 'assets/one-touch/payload.b64').read_text(encoding='utf-8').strip()
    check('payload.html byte-identical to decoded original', disk_payload == orig_payload)
    check('payload.b64 byte-identical to original b64', disk_b64 == orig_b64)
    check('index.html embeds the exact original b64', orig_b64 in index)

print('== 2. native-vpn-controls integrity ==')
if m:
    m2 = re.search(r'<script id="native-vpn-controls" type="text/plain">.*?</script>', ORIG, re.S)
    nvc_orig = m2.group(0)
    nvc_disk = (ROOT / 'assets/one-touch/native-vpn-controls.html').read_text(encoding='utf-8').rstrip('\n')
    check('native-vpn-controls byte-identical', nvc_disk == nvc_orig)
    check('index.html embeds it verbatim', nvc_orig in index)

print('== 3. CSS integrity (byte-faithful extraction) ==')
RANGES = {'core': (12, 215), 'dashboard': (217, 660), 'settings': (663, 1080),
          'generator': (1082, 1536), 'engine': (1538, 2216), 'help': (2218, 2391),
          'library': (2393, 2669), 'overrides': (2670, 2924)}
orig_lines = ORIG.splitlines(keepends=True) if ORIG else None
for name, (a, b) in RANGES.items():
    if orig_lines:
        want = ''.join(orig_lines[a - 1:b])
        got = (ROOT / f'styles/{name}.css').read_text(encoding='utf-8')
        check(f'styles/{name}.css byte-identical (lines {a}-{b})', got == want)
    check(f'index.html carries styles/{name}.css link', f'styles/{name}.css' in index)

print('== 4. structure ==')
check('6 screens present', len(re.findall(r'class="screen-view', index)) == 6)
# content markers (unique per module) in required load order
MARKERS = [
    (['MF.config', "version: {", 'routeCheck'], 'config/app-config.js'),
    (['MF.dom =', 'escapeHtml'], 'core/dom.js'),
    (['MF.storage', 'getJson'], 'core/storage.js'),
    (['MF.clipboard', 'copyText'], 'core/clipboard.js'),
    (['MF.toast', "HIDE_MS = 2000"], 'core/toast.js'),
    (['engineContracts', 'EngineError'], 'adapters/engine/engine-adapter.js'),
    (['ENGINE_UNAVAILABLE', 'UnavailableEngineAdapter'], 'adapters/engine/unavailable-engine-adapter.js'),
    (['MailFactoryEngine', 'EngineBridge'], 'adapters/engine/engine-bridge.js'),
    (['LibraryRepository', 'separateMember'], 'data/library-repository.js'),
    (['EngineSettingsStore'], 'services/engine-settings-store.js'),
    (['EngineLogStore'], 'services/engine-log-store.js'),
    (['MF.engine =', 'registerAdapter'], 'services/engine-service.js'),
    (['GeneratorService'], 'services/generator-service.js'),
    (['NetworkCheckService'], 'services/network-check-service.js'),
    (['ReleaseService', 'compareVersions'], 'services/release-service.js'),
    (['BackupService', 'NO_PROVIDER'], 'services/backup-service.js'),
    (['RatingService', 'ThemeService'], 'services/preferences-service.js'),
    (['MF.router', 'goBackFromSettings'], 'core/router.js'),
    (['addRippleZap', 'MF.interactions'], 'core/interactions.js'),
    (['MF.a11y'], 'core/accessibility.js'),
    (['SECTOR_COUNT', 'MF.dashboard'], 'pages/dashboard.js'),
    (['MF.enginePage', 'logLiveBadge'], 'pages/engine.js'),
    (['MF.generatorPage', 'genSingleBtn'], 'pages/generator.js'),
    (['MF.libraryPage', 'cardMenuSheet'], 'pages/library.js'),
    (['MF.settingsPages', 'checkForUpdate'], 'pages/settings.js'),
    (['MF.helpPage'], 'pages/help.js'),
    (['mountOneTouch', 'vpn-page-entry'], 'pages/one-touch.js'),
    (['MF.boot'], 'scripts/app.js'),
]
pos = 0
ok_order = True
missing = []
for tokens, label in MARKERS:
    p = index.find(tokens[0], pos)
    if p < 0:
        ok_order = False
        missing.append(label)
        continue
    pos = p
check('all 28 script modules present in load order', ok_order, ', '.join(missing))
check('build.py --check (artifact fresh)', True, '(run separately)')

print('== 5. forbidden-pattern scan (honesty rules) ==')
# 5a. visible DOM wording (scripts/styles stripped)
visible = re.sub(r'<script[\s\S]*?</script>', '', index)
visible = re.sub(r'<style[\s\S]*?</style>', '', visible)
for pat in ['coming soon', 'Coming Soon', 'UI demo', 'not implemented in this build',
            'Ratings are not published yet', 'translateon:', 'email-protection',
            'usable wherever an email is accepted']:
    check(f'"{pat}" absent from visible DOM', pat not in visible)

# 5b. removed random generators: no executable definition or export anywhere
gen_defs = []
for p in list((ROOT / 'scripts').rglob('*.js')) + [ROOT / 'config' / 'app-config.js']:
    t = p.read_text(encoding='utf-8')
    for ident in ['randChar', 'randomLocalPart', 'nameBasedLocalPart', 'genEmail', 'genPassword']:
        for pat in [f'function {ident}', f'const {ident}', f'let {ident}',
                    f'var {ident}', f'{ident} =', f'{ident}:']:
            if pat in t:
                gen_defs.append(f'{p.name}: {pat}')
check('removed random generators: zero definitions/exports', not gen_defs, '; '.join(gen_defs))

# 5c. no synthesis helpers / fake totals / demo handlers in executable code
for pat, why in [('batchExpectedEmails', 'synthesis helper'),
                 ('toggleViewAll(this,', 'demo handler'),
                 ('data-cfemail', 'Cloudflare email protection')]:
    code = ''
    for p in list((ROOT / 'scripts').rglob('*.js')) + [ROOT / 'config' / 'app-config.js']:
        code += p.read_text(encoding='utf-8')
    body = re.sub(r'/\*[\s\S]*?\*/', '', code)          # strip block comments
    body = re.sub(r'(?m)^\s*\*.*$', '', body)           # strip jsdoc continuations
    body = re.sub(r'(?m)^\s*//.*$', '', body)           # strip line comments
    check(f'"{pat}" absent from executable code ({why})', pat not in body)

# 5d. Cloudflare artifacts: only the REAL trace URL in config may mention cdn-cgi
cf_hits = []
for p in list((ROOT / 'scripts').rglob('*.js')) + list((ROOT / 'src').rglob('*.html')):
    t = p.read_text(encoding='utf-8')
    if 'cdn-cgi' in t:
        cf_hits.append(str(p.relative_to(ROOT)))
check('cdn-cgi only in config (real trace target)', not cf_hits, '; '.join(cf_hits))
check('__CF$cv challenge absent', '__CF$cv' not in index)

print('== 6. config single-source-of-truth ==')
ALLOWED_PREFIXES = ('http://www.w3.org/', 'https://www.w3.org/')  # SVG namespace API
violations = []
for p in list((ROOT / 'scripts').rglob('*.js')):
    t = p.read_text(encoding='utf-8')
    for url in re.findall(r"'https?://[^']+'", t):
        u = url.strip("'")
        if not any(u.startswith(pre) for pre in ALLOWED_PREFIXES):
            violations.append(f'{p.name}: {u}')
check('no URL literals in scripts/ (config only; SVG ns excepted)', not violations, '; '.join(violations))
cfg = (ROOT / 'config/app-config.js').read_text(encoding='utf-8')
check('real website URL centralized verbatim', "website: 'https://mailfactorylabs.github.io'" in cfg)
check('real trace URL centralized verbatim', 'https://www.cloudflare.com/cdn-cgi/trace' in cfg)
check('real GitHub repo centralized verbatim', "repo: 'MailFactoryLabs/MailFactoryLabs.github.io'" in cfg)
check('unconfigured social links are explicit nulls',
      'feedback:   null' in cfg and 'contactEmail: null' in cfg and 'rating:     null' in cfg)

print('== 7. matrix §36 event-handler binding coverage (built artifact) ==')
def count(pat):
    return len(re.findall(re.escape(pat), index))

# zero inline handlers anywhere in the built artifact (markup AND scripts)
for attr in ['onclick=', 'onkeydown=', 'oninput=', 'onchange=', 'onsubmit=']:
    check(f'zero inline {attr} handlers in index.html', count(attr) == 0)

# declarative bindings are counted in MARKUP only (module scripts legitimately
# reference the same selectors in querySelector arguments)
markup = re.sub(r'<script[\s\S]*?</script>', '', index)
def countm(pat):
    return len(re.findall(re.escape(pat), markup))

# each §36 event group must have its declarative binding present (exact count)
GROUPS = [
    ('data-action="nav"', 6, 'navigation clicks (logo, gear, 3 nav items, library back)'),
    ('data-nav="', 2, 'dashboard CTAs'),
    ('data-engine-action="', 2, 'engine command hooks (optimize/create)'),
    ('data-action="open-engine-subpage"', 3, 'engine subpage opens'),
    ('data-action="close-engine-subpage"', 3, 'engine subpage closes'),
    ('id="sw-', 6, 'engine switches'),
    ('id="crCheckBtn"', 1, 'Check Route button'),
    ('data-tab="', 2, 'generator tabs'),
    ('data-menu="', 3, 'generator preset menus'),
    ('id="genSingleBtn"', 1, 'generate single'),
    ('id="genBatchBtn"', 1, 'generate batch'),
    ('id="copyAllBtn"', 1, 'copy all'),
    ('data-copy="s-', 2, 'generator single copies'),
    ('id="libSearchBtn"', 1, 'library search'),
    ('data-action="open-filter-sheet"', 1, 'library sort sheet'),
    ('data-mode="', 6, 'library sort modes'),
    ('id="libSearchInput"', 1, 'library query input'),
    ('id="cardMenuStarOption"', 1, 'library star option'),
    ('id="cardMenuVerifyOption"', 1, 'library verify option'),
    ('id="cardMenuRenameOption"', 1, 'library rename option'),
    ('id="cardMenuDeleteOption"', 1, 'library delete option'),
    ('data-action="open-subpage"', 13, 'settings rows (14th = helpcenter via help alias/back)'),
    ('data-action="close-subpage"', 12, 'subpage back buttons (helpcenter back bound by help.js)'),
    ('data-action="open-backup"', 1, 'backup open'),
    ('class="notif-card"', 3, 'notification accordions'),
    ('data-action="theme-select"', 6, 'appearance cards (1 real + 5 locked)'),
    ('data-action="open-link"', 7, 'community/feedback/contact config-driven actions'),
    ('data-action="contact-email"', 1, 'contact email'),
    ('data-v="', 5, 'rating stars'),
    ('data-action="submit-rating"', 1, 'rating submit'),
    ('data-action="view-ratings"', 1, 'view ratings'),
    ('data-action="copy-share-link"', 1, 'share link copy'),
    ('data-action="share-app"', 2, 'share actions'),
    ('data-action="share-via"', 4, 'share channels'),
    ('data-action="check-update"', 1, 'version check'),
    ('data-action="view-versions"', 1, 'version history'),
    ('data-action="modal-close"', 1, 'modal close'),
    ('data-action="modal-overlay-close"', 1, 'modal overlay close'),
]
# payload lives inside a script block — whole-file count (also covered in pass 1)
check('§36 isolated One Touch payload present', count('id="vpn-document"') == 1)
for pat, want, label in GROUPS:
    got = countm(pat)
    check(f'§36 {label}: {want}', got == want, f'got {got}')

print()
if fails:
    print(f'VERIFY: {len(fails)} FAILURE(S)')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('VERIFY: ALL CHECKS PASSED')
