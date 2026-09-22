/* =========================================================================
 * MF.interactions — ripple/zap feedback + dashboard/engine button wiring
 * -------------------------------------------------------------------------
 * Behaviour-preserving port of the source's addRippleZap + .btn binder:
 *   - every .btn (dashboard CTAs, engine action rows, engine switches —
 *     exactly like the source) gets the ripple + zap flash on click,
 *   - [data-nav] buttons navigate after the 300ms feedback window so the
 *     animation can play (source comment preserved),
 *   - [data-engine-action] buttons route through the engine facade; while
 *     no engine is attached the user gets the truthful "not connected"
 *     message instead of the source's placeholder toast,
 *   - [data-nav]/[data-engine-action] divs also gain role/tabindex and
 *     Enter/Space activation (accessibility binder preserved).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function addRippleZap(el, e) {
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.3;
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    var clickX = (e && e.clientX ? e.clientX : (rect.left + rect.width / 2)) - rect.left - size / 2;
    var clickY = (e && e.clientY ? e.clientY : (rect.top + rect.height / 2)) - rect.top - size / 2;
    ripple.style.left = clickX + 'px';
    ripple.style.top = clickY + 'px';
    el.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
    el.classList.add('zap');
    setTimeout(function () { el.classList.remove('zap'); }, 500);
  }

  function init() {
    // Generic nav elements (utility header logo/settings + bottom nav items).
    MF.dom.qa('[data-action="nav"]').forEach(function (el) {
      if (el.dataset.navBound === '1') return;
      el.dataset.navBound = '1';
      el.addEventListener('click', function () { MF.router.showScreen(el.dataset.screen); });
      if (el.tagName !== 'BUTTON') {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        });
      }
    });

    MF.dom.qa('.btn').forEach(function (btn) {
      if (btn.dataset.nav || btn.dataset.engineAction) {
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });
      }
      btn.addEventListener('click', function (e) {
        addRippleZap(this, e);
        var nav = this.dataset.nav;
        if (nav) {
          setTimeout(function () { MF.router.showScreen(nav); }, 300);
          return;
        }
        var action = this.dataset.engineAction;
        if (action) {
          MF.engine.execute(action).catch(function () {
            MF.toast.show(MF.toast.messages.engineNotConnected);
          });
        }
      });
    });
  }

  MF.interactions = { addRippleZap: addRippleZap, init: init };
  global.addRippleZap = addRippleZap;
})(window);
