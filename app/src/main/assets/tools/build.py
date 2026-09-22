#!/usr/bin/env python3
"""build.py — assembles MAIL_FACTORY/index.html from the modular tree.

The source application was a single HTML file; the deliverable keeps that
deployment model (Android-WebView friendly, no bundler, no framework) while
the repository itself stays modular: partials, styles, config, services and
page controllers are separate files, and this script stitches them together
in the exact source order.

Usage: python3 tools/build.py            (writes index.html)
       python3 tools/build.py --check    (fails if index.html is stale)
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'

STYLES = ['core', 'dashboard', 'settings', 'generator', 'engine', 'help',
          'library', 'overrides']

SCRIPTS = [
    'config/app-config.js',
    # core
    'scripts/core/dom.js',
    'scripts/core/storage.js',
    'scripts/core/clipboard.js',
    'scripts/core/toast.js',
    # engine adapter boundary
    'scripts/adapters/engine/engine-adapter.js',
    'scripts/adapters/engine/unavailable-engine-adapter.js',
    'scripts/adapters/engine/engine-bridge.js',
    # data
    'scripts/data/library-repository.js',
    # services
    'scripts/services/engine-settings-store.js',
    'scripts/services/engine-log-store.js',
    'scripts/services/engine-service.js',
    'scripts/services/generator-service.js',
    'scripts/services/network-check-service.js',
    'scripts/services/release-service.js',
    'scripts/services/backup-service.js',
    'scripts/services/preferences-service.js',
    # app shell + page controllers
    'scripts/core/router.js',
    'scripts/core/interactions.js',
    'scripts/core/accessibility.js',
    'scripts/pages/dashboard.js',
    'scripts/pages/engine.js',
    'scripts/pages/generator.js',
    'scripts/pages/library.js',
    'scripts/pages/settings.js',
    'scripts/pages/help.js',
    'scripts/pages/one-touch.js',
    'scripts/app.js',
]

# Source order of the settings overlay pages (source lines 4303-5170).
SETTINGS_PAGES = [
    'settings/backup.html',        # backupScreen
    'settings/notifications.html',
    'settings/language.html',
    'settings/appearance.html',
    'settings/help-support.html',  # page-helpcenter
    'settings/send-feedback.html',
    'settings/report-problem.html',
    'settings/contact-us.html',
    'settings/rate-app.html',
    'settings/share-app.html',
    'settings/privacy-policy.html',
    'settings/terms.html',
    'settings/about.html',
    'settings/version.html',
]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def build():
    head = read('src/head.html')            # doctype/head minus <style>
    out = []
    out.append(head)
    for name in STYLES:
        out.append(f'<link rel="stylesheet" href="styles/{name}.css">\n')
    out.append('</head>\n<body>\n\n')
    out.append('<div class="app-root">\n')
    out.append('''  <div id="appSplash" style="position:fixed;inset:0;z-index:99999;background:#030406;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.6s ease, filter 0.6s ease, transform 0.6s ease;opacity:1;pointer-events:all;">
    <img src="assets/logo/logo.png" style="width:138px;height:138px;object-fit:contain;filter:drop-shadow(0 0 22px rgba(255,34,34,0.65));animation:splashPulse 1.8s ease-in-out infinite alternate;" alt="Mail Factory">
    <div style="margin-top:22px;font-family:Inter,sans-serif;font-weight:900;font-size:28px;letter-spacing:5px;color:#fff;text-shadow:0 0 18px rgba(255,255,255,0.35);">MAIL <span style="color:#ea0c20;text-shadow:0 0 25px rgba(234,12,32,0.85);">FACTORY</span></div>
  </div>
  <script>
    setTimeout(function() {
      var splash = document.getElementById('appSplash');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.filter = 'blur(8px)';
        splash.style.transform = 'scale(1.03)';
        setTimeout(function() { splash.remove(); }, 650);
      }
    }, 2200);
  </script>
  <style>
    @keyframes splashPulse {
      0% { transform: scale(0.97); filter: drop-shadow(0 0 12px rgba(255,34,34,0.45)); }
      100% { transform: scale(1.03); filter: drop-shadow(0 0 28px rgba(234,12,32,0.85)); }
    }
  </style>\n''')
    out.append(read('src/components/utility-header.html'))
    out.append(read('src/components/utility-nav.html'))
    out.append(read('src/pages/dashboard.html'))
    out.append(read('src/pages/engine.html'))
    out.append(read('src/pages/generator.html'))
    out.append(read('src/pages/library.html'))
    out.append(read('src/pages/one-touch.html'))
    # Settings screen: wrapper + the source's svg defs live INSIDE it,
    # exactly as in the source (defs then .screen). The sub-pages, toast and
    # update modal are also inside #screen-settings in the source (the
    # `.scr-settings .backup-screen` / `:has() #toast` rules depend on this),
    # and toast-modal.html ends with the </div> that closes the wrapper.
    out.append('<div class="screen-view scr-settings" data-screen="settings" id="screen-settings">\n')
    out.append(read('src/components/svg-defs.html'))
    out.append(read('src/pages/settings/settings.html'))
    for rel in SETTINGS_PAGES:
        out.append(read(f'src/pages/{rel}'))
    out.append(read('src/components/toast-modal.html'))  # ends screen-settings
    out.append('</div>\n')                               # app-root close
    out.append('\n')
    # scripts
    for rel in SCRIPTS:
        body = read(rel)
        out.append(f'<script>\n{body}\n</script>\n')
    # One Touch security boundary: payload + controls re-skin, byte-faithful.
    out.append(read('assets/one-touch/native-vpn-controls.html'))
    out.append('<script id="vpn-document" type="application/octet-stream">')
    out.append(read('assets/one-touch/payload.b64'))
    out.append('</script>\n')
    out.append('</body>\n</html>\n')
    return ''.join(out)


def main():
    html = build()
    target = ROOT / 'index.html'
    if '--check' in sys.argv:
        if target.exists() and target.read_text(encoding='utf-8') == html:
            print('index.html is up to date')
            return
        print('index.html is STALE — run tools/build.py')
        sys.exit(1)
    target.write_text(html, encoding='utf-8')
    print(f'index.html written ({len(html):,} chars)')


if __name__ == '__main__':
    main()
