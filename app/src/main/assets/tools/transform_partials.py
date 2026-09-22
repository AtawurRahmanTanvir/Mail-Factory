#!/usr/bin/env python3
"""transform_partials.py — converts extracted byte-faithful partials to the
modular event-binding markup (data-action attributes instead of inline
onclick) and applies the honesty edits mandated by the implementation
matrix. Every replacement is an exact-string pair; a failed match aborts so
nothing silently passes through."""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'src'  # project-root relative

# This script is the RECORD of the one-time partial transformation (inline
# handlers -> data bindings, honesty edits). The partials in src/ have
# already been transformed; running it again is a no-op. To re-apply from
# scratch, re-extract the partials from the original source first.
_marker = (ROOT / 'pages' / 'engine.html')
if _marker.exists() and 'data-engine-action' in _marker.read_text(encoding='utf-8'):
    print('transform_partials: partials already transformed — nothing to do (idempotent no-op).')
    print('  This file is kept as the auditable record of every applied edit.')
    sys.exit(0)

def apply(path, pairs, optional=()):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    for entry in pairs:
        old, new = entry[0], entry[1]
        want = entry[2] if len(entry) > 2 else 1
        got = text.count(old)
        if got != want:
            print(f'COUNT MISMATCH in {path}: {old[:90]!r} want={want} got={got}')
            sys.exit(1)
        text = text.replace(old, new)
    p.write_text(text, encoding='utf-8')
    print(f'OK  {path} ({len(pairs)} edits)')

# ---------------------------------------------------------------- engine ---
apply('pages/engine.html', [
    # OPTIMIZE SYSTEM: fake placeholder toast removed -> engine command hook
    ('data-toast="System optimization is not implemented in this build yet."',
     'data-engine-action="optimizeSystem"'),
    # CREATE ACCOUNT: engine command hook only (no navigation, no fake result)
    ('<div class="btn secondary">\n      <div class="ic">',
     '<div class="btn secondary" data-engine-action="createAccount">\n      <div class="ic">'),
    # Check Route button: module-bound
    (' id="crCheckBtn" onclick="runRouteCheck()"', ' id="crCheckBtn"'),
    # subpage open/close rows
    ('onclick="openEngineSubpage(\'checkroute\')"', 'data-action="open-engine-subpage" data-page="checkroute"'),
    ('onclick="openEngineSubpage(\'logengine\')"', 'data-action="open-engine-subpage" data-page="logengine"'),
    ('onclick="openEngineSubpage(\'systemsettings\')"', 'data-action="open-engine-subpage" data-page="systemsettings"'),
    ('onclick="closeEngineSubpage(\'checkroute\')"', 'data-action="close-engine-subpage" data-page="checkroute"'),
    ('onclick="closeEngineSubpage(\'logengine\')"', 'data-action="close-engine-subpage" data-page="logengine"'),
    ('onclick="closeEngineSubpage(\'systemsettings\')"', 'data-action="close-engine-subpage" data-page="systemsettings"'),
    (' onclick="toggleEngineSwitch(this)"', '', 6)])

# --------------------------------------------------------------- library ---
lib = ROOT / 'pages/library.html'
text = lib.read_text(encoding='utf-8')

# 1) remove the five hardcoded demo cards (list rendered from repository)
start = text.index('<div class="list" id="list">')
open_end = text.index('\n', start) + 1
close_marker = '  </div>\n\n  <footer>'
close_idx = text.index(close_marker)
text = text[:open_end] + text[close_idx:]

pairs = [
    ('<button class="app-back-btn" onclick="showScreen(\'dashboard\')"',
     '<button class="app-back-btn" data-action="nav" data-screen="dashboard"'),
    (' id="libSearchBtn" onclick="openSearchSheet()"', ' id="libSearchBtn"'),
    ('<button class="icon-btn active" onclick="openFilterSheet()"',
     '<button class="icon-btn active" data-action="open-filter-sheet"'),
    (' id="backdrop" onclick="closeSheetsWithSearchReset()"', ' id="backdrop"'),
    ('<div class="sheet-option" onclick="toggleStarCurrent()">',
     '<div class="sheet-option" id="cardMenuStarOption">'),
    (' id="cardMenuVerifyOption" onclick="toggleVerificationCurrent()"', ' id="cardMenuVerifyOption"'),
    (' id="cardMenuRenameOption" onclick="renameCurrent()"', ' id="cardMenuRenameOption"'),
    (' id="cardMenuDeleteOption" onclick="deleteCurrent()"', ' id="cardMenuDeleteOption"'),
]
for mode in ['newest', 'oldest', 'singles', 'batches', 'starred', 'verified']:
    pairs.append((f' data-mode="{mode}" onclick="selectSort(\'{mode}\')"', f' data-mode="{mode}"'))
for old, new in pairs:
    if text.count(old) != 1:
        print(f'NON-UNIQUE/MISS in library: {old[:80]!r} ({text.count(old)})'); sys.exit(1)
    text = text.replace(old, new)
lib.write_text(text, encoding='utf-8')
print(f'OK  pages/library.html ({len(pairs)} edits, demo cards removed)')

# -------------------------------------------------------------- settings ---
# Root Settings screen: open handlers + back. (Subpage back buttons live in
# their own partial files and are converted below.)
pairs = []
for page in ['version', 'termsofservice', 'sharetheapp', 'sendfeedback',
             'reportproblem', 'ratetheapp', 'privacypolicy', 'notifications',
             'language', 'contactus', 'appearance', 'aboutmailfactory', 'helpcenter']:
    pairs.append((f'onclick="openSettingsSubpage(\'{page}\')"',
                  f'data-action="open-subpage" data-page="{page}"'))
pairs += [
    ('onclick="openBackupScreen()"', 'data-action="open-backup"'),
    ('onclick="goBackFromSettings()"', 'data-action="settings-back"'),
]
apply('pages/settings/settings.html', pairs)

# Subpage back buttons (close handlers), one per subpage partial.
sub_backs = [('version', 'version'), ('terms', 'termsofservice'),
             ('share-app', 'sharetheapp'), ('send-feedback', 'sendfeedback'),
             ('report-problem', 'reportproblem'), ('rate-app', 'ratetheapp'),
             ('privacy-policy', 'privacypolicy'), ('notifications', 'notifications'),
             ('language', 'language'), ('contact-us', 'contactus'),
             ('appearance', 'appearance'), ('about', 'aboutmailfactory')]
for fname, page in sub_backs:
    apply(f'pages/settings/{fname}.html', [
        (f'onclick="closeSettingsSubpage(\'{page}\')"',
         f'data-action="close-subpage" data-page="{page}"'),
    ])

# backup screen — provider boundary, honest copy, no "UI demo" phrasing
apply('pages/settings/backup.html', [
    ('onclick="closeBackupScreen()"', 'data-action="close-backup"'),
    ('onclick="toggleConnect(event,this,\'Google Drive\')"', 'data-action="backup-connect" data-provider="gdrive" data-label="Google Drive"'),
    ('onclick="toggleConnect(event,this,\'Google Docs\')"', 'data-action="backup-connect" data-provider="gdocs" data-label="Google Docs"'),
    ('onclick="toggleConnect(event,this,\'GitHub\')"', 'data-action="backup-connect" data-provider="github" data-label="GitHub"'),
    ('onclick="toggleConnect(event,this,\'Dropbox\')"', 'data-action="backup-connect" data-provider="dropbox" data-label="Dropbox"'),
    ('onclick="toggleConnect(event,this,\'OneDrive\')"', 'data-action="backup-connect" data-provider="onedrive" data-label="OneDrive"'),
    ('onclick="toggleConnect(event,this,\'Phone Storage\')"', 'data-action="backup-connect" data-provider="phone" data-label="Phone Storage"'),
    # REMOVED: "This is a UI demo — wire each provider's real OAuth flow…"
    ('Connect a destination to automatically back up your data. This is a UI demo — wire each provider\'s real OAuth flow on your backend to make connections live.',
     'Connect a destination to automatically back up your data. No provider is connected yet — connections activate when a real provider adapter is configured.'),
])

# appearance — no "coming soon" anywhere; cards go through ThemeService
apply('pages/settings/appearance.html', [
    ('<div class="theme-card active">', '<div class="theme-card active" data-action="theme-select" data-theme="dark-red" data-label="Dark Red">'),
    ('<div class="theme-card locked" onclick="showToast(\'Cyber Blue theme is locked — coming soon\')">',
     '<div class="theme-card locked" data-action="theme-select" data-theme="cyber-blue" data-label="Cyber Blue">'),
    ('<div class="theme-card locked" onclick="showToast(\'Neon Purple theme is locked — coming soon\')">',
     '<div class="theme-card locked" data-action="theme-select" data-theme="neon-purple" data-label="Neon Purple">'),
    ('<div class="theme-card locked" onclick="showToast(\'Matrix Green theme is locked — coming soon\')">',
     '<div class="theme-card locked" data-action="theme-select" data-theme="matrix-green" data-label="Matrix Green">'),
    ('<div class="theme-card locked" onclick="showToast(\'Arctic White theme is locked — coming soon\')">',
     '<div class="theme-card locked" data-action="theme-select" data-theme="arctic-white" data-label="Arctic White">'),
    ('<div class="theme-card locked" onclick="showToast(\'Stealth Gray theme is locked — coming soon\')">',
     '<div class="theme-card locked" data-action="theme-select" data-theme="stealth-gray" data-label="Stealth Gray">'),
])

# language — remove the "translation coming" framing (no fake promises)
apply('pages/settings/language.html', [
    ('Choose your preferred language. Full app translation is coming in a future update — for now this sets your selection only.',
     'Choose your preferred language. Your selection is saved on this device.'),
])

# rate the app — stars module-bound; rating path is honest
apply('pages/settings/rate-app.html', [
    (' onclick="setStarRating(1)"', ''), (' onclick="setStarRating(2)"', ''),
    (' onclick="setStarRating(3)"', ''), (' onclick="setStarRating(4)"', ''),
    (' onclick="setStarRating(5)"', ''),
    ('onclick="submitRating()"', 'data-action="submit-rating"'),
    ('onclick="showToast(\'Ratings are not published yet.\')"', 'data-action="view-ratings"'),
])

# share the app
apply('pages/settings/share-app.html', [
    ('onclick="copyShareLink()"', 'data-action="copy-share-link"'),
    ('onclick="shareApp()"', 'data-action="share-app"', 2),
    ('onclick="shareVia(\'WhatsApp\')"', 'data-action="share-via" data-app="WhatsApp"'),
    ('onclick="shareVia(\'Messenger\')"', 'data-action="share-via" data-app="Messenger"'),
    ('onclick="shareVia(\'Telegram\')"', 'data-action="share-via" data-app="Telegram"'),
    ('onclick="shareVia(\'Facebook\')"', 'data-action="share-via" data-app="Facebook"'),
])

# contact us — config-driven links, truthful when unconfigured, no "coming soon"
apply('pages/settings/contact-us.html', [
    ('onclick="openContactEmail()"', 'data-action="contact-email"'),
    ('onclick="showToast(\'The Facebook contact link is coming soon.\')"', 'data-action="open-link" data-link="facebook" data-label="Facebook"'),
    ('onclick="showToast(\'The WhatsApp contact link is coming soon.\')"', 'data-action="open-link" data-link="whatsapp" data-label="WhatsApp"'),
    ('onclick="showToast(\'The Telegram contact link is coming soon.\')"', 'data-action="open-link" data-link="telegram" data-label="Telegram"'),
    ('onclick="showToast(\'The YouTube channel link is coming soon.\')"', 'data-action="open-link" data-link="youtube" data-label="YouTube channel"'),
])

# help & support — community links config-driven; helpcenter back handled by help.js
apply('pages/settings/help-support.html', [
    ('onclick="showToast(\'The official Telegram link is coming soon.\')"', 'data-action="open-link" data-link="telegram" data-label="Telegram"'),
    ('onclick="showToast(\'The official Facebook group link is coming soon.\')"', 'data-action="open-link" data-link="facebook" data-label="Facebook group"'),
    ('<div class="back-btn" onclick="closeSettingsSubpage(\'helpcenter\')">', '<div class="back-btn">'),
])

# send feedback — no "coming soon"; config-driven destination
apply('pages/settings/send-feedback.html', [
    ('onclick="showToast(\'The feedback channel link is coming soon. Use Report a Problem for issues.\')"',
     'data-action="open-link" data-link="feedback" data-label="Feedback channel"'),
])

# notifications — accordion bound by module
apply('pages/settings/notifications.html', [
    (' onclick="this.classList.toggle(\'expanded\')"', '', 3),
])

# version — real integrations stay, handlers module-bound
apply('pages/settings/version.html', [
    ('onclick="checkForUpdate()"', 'data-action="check-update"'),
    ('onclick="viewVersionHistory()"', 'data-action="view-versions"'),
])

# report a problem — real GitHub anchors get config-driven hrefs
apply('pages/settings/report-problem.html', [
    ('<a class="sp-btn ghost" href="https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues" target="_blank" rel="noopener noreferrer" style="margin-bottom:10px;">',
     '<a class="sp-btn ghost" id="linkKnownIssues" href="https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues" target="_blank" rel="noopener noreferrer" style="margin-bottom:10px;">'),
    ('<a class="sp-btn" href="https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues/new" target="_blank" rel="noopener noreferrer">',
     '<a class="sp-btn" id="linkNewIssue" href="https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues/new" target="_blank" rel="noopener noreferrer">'),
])

# toast + update modal
apply('components/toast-modal.html', [
    ('onclick="closeModalOnOverlay(event)"', 'data-action="modal-overlay-close"'),
    ('<button class="modal-close" onclick="closeModal()">', '<button class="modal-close" data-action="modal-close">'),
])

# Log Engine — REMOVE the 3 hardcoded fake log lines from markup (the honest
# runtime line comes from EngineLogStore when the page opens).
apply('pages/engine.html', [
    ('        <div class="log-line ok"><span class="tag">[SYSTEM]</span> Log engine initialized</div>\n', ''),
    ('        <div class="log-line ok"><span class="tag">[SYSTEM]</span> Console ready</div>\n', ''),
    ('        <div class="log-line"><span class="tag">[IDLE]</span> Awaiting activity…</div>\n', ''),
])

# Log Engine LIVE badge gets a stable id for the honest state binding.
apply('pages/engine.html', [
    ('<div class="log-live-badge"><span class="dot"></span>LIVE</div>',
     '<div class="log-live-badge" id="logLiveBadge"><span class="dot"></span>LIVE</div>'),
])

# Library FAQ correction (user-verified falsehood): generated addresses are
# NOT guaranteed "usable wherever an email is accepted" — say the truth.
apply('pages/settings/help-support.html', [
    ("Yes, they're standard, valid addresses usable wherever an email is accepted.",
     "They're formatted as standard addresses, but deliverability depends on the engine and the receiving service — verify before relying on them."),
])

# Notifications: the 3 static informational cards must not present "Today"
# as a fabricated real-event timestamp (it would say "Today" forever).
# Classified explicitly as static info via an INFO chip (same chip styling).
apply('pages/settings/notifications.html', [
    ('>Today</div>', '>INFO</div>', 3),
])

print('ALL TRANSFORMS COMPLETE')
