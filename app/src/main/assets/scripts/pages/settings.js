/* =========================================================================
 * Mail Factory — Settings screen controller
 * -------------------------------------------------------------------------
 * Preserves the entire Settings architecture: root navigation, every
 * sub-page, back behaviour, language selection persistence, notifications
 * accordions, backup UI, appearance, rating, share, contact, and the REAL
 * version/release integration (GitHub API, kept real — matrix §31).
 *
 * Honesty changes (all matrix-directed):
 *  - Backup connect: routes through BackupService; no provider adapters
 *    exist yet, so the response is the truthful "no backup provider is
 *    connected" — never a fake Connected state.
 *  - Appearance: locked themes say they are locked; "coming soon" is gone.
 *  - Rating: saves the local choice for real; external submission happens
 *    only when config.links.rating provides a real destination.
 *  - Contact/Feedback/community buttons: config-driven; unconfigured means
 *    a truthful toast, never an invented URL.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  /* ---------------- sub-page + backup open/close (source parity) -------- */

  function openSettingsSubpage(id) {
    var el = document.getElementById('page-' + id);
    if (!el) return;
    el.classList.add('open');
    if (id === 'language') renderLanguageList();
  }
  function closeSettingsSubpage(id) {
    var el = document.getElementById('page-' + id);
    if (!el) return;
    el.classList.remove('open');
  }
  function openBackupScreen() {
    document.getElementById('backupScreen').classList.add('open');
  }
  function closeBackupScreen() {
    document.getElementById('backupScreen').classList.remove('open');
  }

  /* ---------------- Language (REAL persisted selection) ------------------ */

  var selectedLanguage = 'English';
  var langListRendered = false;

  function loadSavedLanguage() {
    var saved = MF.storage.getRaw(MF.config.storage.language);
    if (saved && MF.config.languages.indexOf(saved) !== -1) selectedLanguage = saved;
  }

  function renderLanguageList() {
    var list = document.getElementById('langList');
    if (!list) return;
    if (langListRendered) return;
    MF.config.languages.forEach(function (name) {
      var row = document.createElement('div');
      row.className = 'row' + (name === selectedLanguage ? ' selected' : '');
      row.setAttribute('data-action', 'select-language');
      row.innerHTML =
        '<div class="icon-box"><svg class="ic"><use href="#i-globe" xlink:href="#i-globe"/></svg></div>' +
        '<span class="lang-name"></span>' +
        '<svg class="lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="5 13 10 18 19 7"/></svg>';
      // Language names are config constants, but textContent is used anyway
      // so the renderer can never become an injection path.
      row.querySelector('.lang-name').textContent = name;
      row.addEventListener('click', function () { selectLanguage(name); });
      list.appendChild(row);
      list.appendChild(Object.assign(document.createElement('div'), { className: 'divider' }));
    });
    // drop the trailing divider (list keeps divider BETWEEN rows, as source)
    if (list.lastElementChild) list.removeChild(list.lastElementChild);
    langListRendered = true;
  }

  function selectLanguage(name) {
    selectedLanguage = name;
    MF.storage.setRaw(MF.config.storage.language, name); // REAL persistence (source key)
    langListRendered = false;
    var list = document.getElementById('langList');
    if (list) list.innerHTML = '';
    renderLanguageList();
    MF.toast.show(name + ' selected');
  }

  /* ---------------- Backup (provider boundary, no fake state) ------------ */

  function connectProvider(providerId, label) {
    MF.BackupService.connect(providerId).then(function (result) {
      if (result.connected) {
        // Only reachable once a real provider adapter is registered.
        MF.toast.show(label + ' connected');
      } else {
        MF.toast.show(MF.toast.messages.backupNotConnected(label));
      }
    });
  }

  /* ---------------- Appearance (locked themes, honest state) ------------- */

  function selectTheme(themeId, name) {
    var result = MF.ThemeService.select(themeId);
    if (!result.applied) MF.toast.show(MF.toast.messages.themeLocked(name));
  }

  /* ---------------- Rate the App (honest submission path) ---------------- */

  var currentRating = 0;

  function setStarRating(n) {
    currentRating = n;
    MF.dom.qa('#starRow svg').forEach(function (star) {
      star.classList.toggle('filled', parseInt(star.dataset.v, 10) <= n);
    });
  }

  function submitRating() {
    if (currentRating === 0) {
      MF.toast.show('Pick a star rating first');
      return;
    }
    // Persist the local choice for real.
    MF.RatingService.saveLocal(currentRating);
    if (MF.RatingService.hasDestination()) {
      // Real external destination configured → hand off to it.
      global.open(MF.RatingService.destination(), '_blank', 'noopener');
      MF.toast.show('Thanks for your ' + currentRating + '-star rating!');
    } else {
      // No destination configured — say exactly what happened.
      MF.toast.show(MF.toast.messages.ratingSaved);
    }
  }

  function viewRatings() {
    if (MF.RatingService.hasDestination()) {
      global.open(MF.RatingService.destination(), '_blank', 'noopener');
    } else {
      MF.toast.show(MF.toast.messages.ratingDestinationMissing);
    }
  }

  /* ---------------- Share (real Web Share/clipboard, config URL) --------- */

  function copyShareLink() {
    MF.clipboard.copyText(MF.config.github.shareUrl).then(function (ok) {
      MF.toast.show(ok ? 'Link copied to clipboard' : 'Could not copy link');
    });
  }

  function shareApp() {
    if (navigator.share) {
      navigator.share({
        title: MF.config.share.title,
        text: MF.config.share.text,
        url: MF.config.github.shareUrl
      }).catch(function () { /* user cancelled the share sheet - not an error */ });
    } else {
      copyShareLink();
    }
  }

  function shareVia(appName) {
    MF.clipboard.copyText(MF.config.github.shareUrl).then(function (ok) {
      MF.toast.show(ok
        ? 'Link copied — share it in ' + appName
        : 'Could not copy the link — use the Project Link row above');
    });
  }

  /* ---------------- Contact (config-driven destinations) ----------------- */

  function openContactEmail() {
    var email = MF.config.links.contactEmail;
    if (!email) {
      MF.toast.show(MF.toast.messages.emailNotConfigured);
      return;
    }
    global.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Mail Factory Support');
  }

  /** Open a configured external link in a new tab; truthful when unset. */
  function openExternal(key, label) {
    var url = MF.config.links[key];
    if (!url) {
      MF.toast.show(MF.toast.messages.linkNotConfigured(label));
      return;
    }
    global.open(url, '_blank', 'noopener,noreferrer');
  }

  /* ---------------- Version (REAL GitHub Releases integration) ----------- */

  var STATUS_ICONS = {
    success: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#34d17c"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#4da3ff"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5" stroke-width="2.2"/><circle cx="12" cy="7.8" r="1.15" fill="currentColor" stroke="none"/></svg>',
    warning: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#ff9f1c"><path d="M12 3.5 2.5 20h19L12 3.5Z"/><line x1="12" y1="10" x2="12" y2="14.2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
    error: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#ff4545"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    update: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#34d17c"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V15M12 15l-3.2-3.2M12 15l3.2-3.2"/></svg>'
  };

  function setModalIcon(iconEl, name) {
    iconEl.innerHTML = (name === 'spinner') ? '<div class="spinner"></div>' : (STATUS_ICONS[name] || STATUS_ICONS.info);
  }
  function setModalAction(href, text) {
    var actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    var a = document.createElement('a');
    a.className = 'modal-btn';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    actions.appendChild(a);
  }
  function openModal() { document.getElementById('updateModalOverlay').classList.add('show'); }
  function closeModal() { document.getElementById('updateModalOverlay').classList.remove('show'); }
  function closeModalOnOverlay(e) {
    if (e.target && e.target.id === 'updateModalOverlay') closeModal();
  }

  function checkForUpdate() {
    openModal();
    var icon = document.getElementById('modalIcon');
    var title = document.getElementById('modalTitle');
    var body = document.getElementById('modalBody');
    var current = MF.config.version.current;

    setModalIcon(icon, 'spinner');
    title.textContent = 'Checking for updates\u2026';
    body.textContent = 'Current version: v' + current;
    document.getElementById('modalActions').innerHTML = '';

    MF.ReleaseService.checkForUpdate().then(function (result) {
      switch (result.status) {
        case 'no-releases':
          setModalIcon(icon, 'info');
          title.textContent = 'No releases yet';
          body.textContent = "This repository has no published releases. You're on v" + current + '.';
          break;
        case 'update-available':
          setModalIcon(icon, 'update');
          title.textContent = 'Update available';
          body.textContent = 'v' + current + ' \u2192 v' + result.latest;
          setModalAction(result.releaseUrl, 'View Release');
          break;
        case 'up-to-date':
          setModalIcon(icon, 'success');
          title.textContent = "You're up to date";
          body.textContent = 'Version v' + current + ' is the latest release.';
          break;
        default: // 'ahead'
          setModalIcon(icon, 'info');
          title.textContent = 'You are ahead of the latest release';
          body.textContent = 'Installed v' + current + ' is newer than the latest published release (v' + result.latest + ').';
      }
    }).catch(function () {
      setModalIcon(icon, navigator.onLine === false ? 'error' : 'warning');
      title.textContent = 'Could not check for updates';
      body.textContent = navigator.onLine === false
        ? 'No network connection. Check your internet connection and try again.'
        : 'The update service could not be reached or returned an invalid response. Try again later.';
    });
  }

  var versionsLoaded = false;

  function noteBox(key, text) {
    var box = document.createElement('div');
    box.className = 'sp-note-box';
    var nk = document.createElement('div');
    nk.className = 'nk';
    nk.textContent = key;
    var nt = document.createElement('div');
    nt.className = 'nt';
    nt.textContent = text;
    box.appendChild(nk); box.appendChild(nt);
    return box;
  }

  function viewVersionHistory() {
    var container = document.getElementById('versionHistoryList');
    var label = document.getElementById('viewVersionsLabel');
    if (!container) return;

    if (versionsLoaded) {
      var isOpen = container.style.display !== 'none';
      container.style.display = isOpen ? 'none' : 'block';
      label.textContent = isOpen ? 'View Versions' : 'Hide Versions';
      return;
    }

    label.textContent = 'Loading…';
    container.innerHTML = '';

    MF.ReleaseService.fetchHistory().then(function (releases) {
      if (!releases.length) {
        container.appendChild(noteBox('No Releases', 'This repository has no published releases yet.'));
      } else {
        releases.forEach(function (r) {
          var item = document.createElement('div');
          item.className = 'release-item';
          var top = document.createElement('div');
          top.className = 'ri-top';
          var ver = document.createElement('span');
          ver.className = 'ri-ver';
          ver.textContent = r.version;
          var tag = document.createElement('span');
          tag.className = 'ri-tag';
          tag.textContent = r.tag;
          top.appendChild(ver); top.appendChild(tag);
          var date = document.createElement('div');
          date.className = 'ri-date';
          date.textContent = r.dateText;
          var notes = document.createElement('div');
          notes.className = 'ri-notes';
          notes.textContent = r.notes;
          var link = document.createElement('a');
          link.className = 'ri-link';
          link.href = r.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'View Release →';
          item.appendChild(top); item.appendChild(date);
          item.appendChild(notes); item.appendChild(link);
          container.appendChild(item);
        });
      }
      container.style.display = 'block';
      label.textContent = 'Hide Versions';
      versionsLoaded = true;
    }).catch(function () {
      container.innerHTML = '';
      container.appendChild(noteBox('Error', navigator.onLine === false
        ? 'No network connection. Check your internet connection and try again.'
        : 'Could not load release history. Try again later.'));
      container.style.display = 'block';
      label.textContent = 'View Versions';
    });
  }

  /* ---------------- notifications accordions (source parity) ------------- */

  function initNotifAccordions() {
    MF.dom.qa('#page-notifications .notif-card').forEach(function (card) {
      card.addEventListener('click', function () { card.classList.toggle('expanded'); });
    });
  }

  /* ---------------- init --------------------------------------------------- */

  function initAction(el) {
    var action = el.dataset.action;
    switch (action) {
      case 'show-screen': el.addEventListener('click', function () { MF.router.showScreen(el.dataset.screen); }); break;
      case 'settings-back': el.addEventListener('click', function () { MF.router.goBackFromSettings(); }); break;
      case 'open-subpage': el.addEventListener('click', function () { openSettingsSubpage(el.dataset.page); }); break;
      case 'close-subpage': el.addEventListener('click', function () { closeSettingsSubpage(el.dataset.page); }); break;
      case 'open-backup': el.addEventListener('click', openBackupScreen); break;
      case 'close-backup': el.addEventListener('click', closeBackupScreen); break;
      case 'backup-connect': el.addEventListener('click', function (e) { e.stopPropagation(); connectProvider(el.dataset.provider, el.dataset.label); }); break;
      case 'theme-select': el.addEventListener('click', function () { selectTheme(el.dataset.theme, el.dataset.label); }); break;
      case 'submit-rating': el.addEventListener('click', submitRating); break;
      case 'view-ratings': el.addEventListener('click', viewRatings); break;
      case 'copy-share-link': el.addEventListener('click', copyShareLink); break;
      case 'share-app': el.addEventListener('click', shareApp); break;
      case 'share-via': el.addEventListener('click', function () { shareVia(el.dataset.app); }); break;
      case 'contact-email': el.addEventListener('click', openContactEmail); break;
      case 'open-link': el.addEventListener('click', function () { openExternal(el.dataset.link, el.dataset.label); }); break;
      case 'check-update': el.addEventListener('click', checkForUpdate); break;
      case 'view-versions': el.addEventListener('click', viewVersionHistory); break;
      case 'modal-close': el.addEventListener('click', closeModal); break;
      case 'modal-overlay-close': el.addEventListener('click', closeModalOnOverlay); break;
      default: break;
    }
  }

  function init() {
    loadSavedLanguage();
    initNotifAccordions();

    // All Settings controls — root screen, sub-pages, backup screen and the
    // update modal live inside #screen-settings (source DOM structure).
    MF.dom.qa('#screen-settings [data-action]').forEach(initAction);

    // Star rating: click + keyboard semantics (source behaviour preserved).
    MF.dom.qa('#starRow svg').forEach(function (el) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Rate ' + el.dataset.v + ' star' + (el.dataset.v === '1' ? '' : 's'));
      el.addEventListener('click', function () { setStarRating(parseInt(el.dataset.v, 10)); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    // Share link display (from config — same rendered text as source).
    var shareText = document.getElementById('shareLinkText');
    if (shareText) shareText.textContent = MF.config.github.shareDisplay;

    // Report-a-Problem anchors: real GitHub destinations from config.
    var known = document.getElementById('linkKnownIssues');
    if (known) known.href = MF.config.github.issues;
    var report = document.getElementById('linkNewIssue');
    if (report) report.href = MF.config.github.newIssue;

    // Version hero copy from config.
    var hero = document.querySelector('#page-version .version-hero .vn');
    if (hero) hero.textContent = 'v' + MF.config.version.current;
  }

  MF.settingsPages = {
    init: init,
    open: openSettingsSubpage,
    close: closeSettingsSubpage
  };

  // Compatibility names (source globals; documented public API).
  global.openSettingsSubpage = openSettingsSubpage;
  global.closeSettingsSubpage = closeSettingsSubpage;
  global.openBackupScreen = openBackupScreen;
  global.closeBackupScreen = closeBackupScreen;
  global.checkForUpdate = checkForUpdate;
  global.viewVersionHistory = viewVersionHistory;
})(window);
