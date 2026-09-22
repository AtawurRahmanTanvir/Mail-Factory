/* =========================================================================
 * MF.router — application shell navigation (one screen at a time, no reload)
 * -------------------------------------------------------------------------
 * Behaviour-preserving port of the source showScreen/syncUtilityShell/
 * goBackFromSettings:
 *   - 'help' is an alias that opens Settings → Help & Support (as source),
 *   - leaving One Touch fires 'vpn-page-exit' into the embedded document,
 *   - entering One Touch mounts it lazily and fires 'vpn-page-entry',
 *   - returning to Dashboard re-measures the hero canvas,
 *   - Settings' back button returns to the last utility screen,
 *   - the utility header/nav visibility rules are unchanged.
 * The active nav item is now detected via data-screen (the source compared
 * the literal onclick attribute string; the attribute changed with the
 * inline-handler cleanup, the behaviour did not).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var lastUtilityScreen = 'engine'; // REAL — source default
  var currentScreen = 'dashboard';  // REAL — source default (markup has dashboard active)

  function syncUtilityShell(name) {
    var visible = ['engine', 'generator', 'onetouch'].indexOf(name) !== -1;
    var header = document.getElementById('utilityHeader');
    var nav = document.getElementById('utilityNav');
    header.hidden = !visible;
    nav.hidden = !visible;
    MF.dom.qa('.app-nav-item', nav).forEach(function (item) {
      var active = item.getAttribute('data-screen') === name;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function showScreen(name) {
    if (name === 'help') { showScreen('settings'); MF.settingsPages.open('helpcenter'); return; }
    var enteringOneTouch = name === 'onetouch'; // Every explicit navigation opens a fresh, disconnected view.
    if (currentScreen === 'onetouch' && name !== 'onetouch') {
      var host = document.getElementById('oneTouchVPN');
      if (host && host.shadowRoot) host.shadowRoot.dispatchEvent(new Event('vpn-page-exit'));
    }
    if (name === 'onetouch') MF.oneTouch.mount();

    var target = document.getElementById('screen-' + name);
    if (!target) return;

    if (currentScreen !== 'settings' && currentScreen !== name) {
      lastUtilityScreen = currentScreen;
    }

    MF.dom.qa('.screen-view').forEach(function (el) { el.classList.remove('active'); });
    target.classList.add('active');
    currentScreen = name;

    // Source called the dashboard's resize() after activation; the ported
    // canvas module exposes the same re-measure via MF.dashboard.onShow().
    if (name === 'dashboard' && MF.dashboard) { try { MF.dashboard.onShow(); } catch (_) {} }
    if (enteringOneTouch) {
      document.getElementById('oneTouchVPN').shadowRoot.dispatchEvent(new Event('vpn-page-entry'));
    }
    if (global.oneTouchLifecycle) global.oneTouchLifecycle();

    syncUtilityShell(name);

    global.scrollTo(0, 0);
  }

  function goBackFromSettings() {
    showScreen(lastUtilityScreen);
  }

  MF.router = {
    showScreen: showScreen,
    goBackFromSettings: goBackFromSettings,
    current: function () { return currentScreen; },
    lastUtility: function () { return lastUtilityScreen; }
  };

  // Compatibility with the source's global function names (documented API).
  global.showScreen = showScreen;
  global.goBackFromSettings = goBackFromSettings;
})(window);
