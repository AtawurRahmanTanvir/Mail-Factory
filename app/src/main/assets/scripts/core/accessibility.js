/* =========================================================================
 * MF.a11y — runtime keyboard accessibility for div-based controls
 * -------------------------------------------------------------------------
 * Preserved from the source (matrix §41): several interactive elements are
 * divs for visual reasons. The source added role/tabindex/Enter-Space to
 * them at runtime via the [onclick] attribute selector; this port binds via
 * the [data-action] attribute instead (inline handlers were removed), with
 * the same exclusions:
 *   - Settings scope: skips real buttons/links/inputs and the .header row
 *   - Library scope: skips real buttons and .batch-header (which keeps its
 *     existing tap behaviour, exactly as in the source)
 * Visuals are unchanged; focus-visible styling comes from the stylesheets.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function bindKeyboard(els) {
    els.forEach(function (el) {
      if (el.closest('button') || el.matches('button,a,input')) return;
      if (el.hasAttribute('role')) return;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
  }

  function init() {
    var settingsEls = MF.dom.qa('#screen-settings [data-action]').filter(function (el) {
      if (el.classList.contains('header')) return false;
      // The Help & Support back control gets its own handler (as in source).
      if (el.dataset.action === 'close-subpage' && el.dataset.page === 'helpcenter') return false;
      return true;
    });
    bindKeyboard(settingsEls);

    bindKeyboard(MF.dom.qa('#screen-library [data-action]').filter(function (el) {
      return !el.classList.contains('batch-header');
    }));
  }

  MF.a11y = { init: init, bindKeyboard: bindKeyboard };
})(window);
