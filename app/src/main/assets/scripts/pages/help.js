/* =========================================================================
 * Mail Factory — Help & Support accordion + Help Center accessibility
 * -------------------------------------------------------------------------
 * Ported 1:1 from the source:
 *  - every `.acc-item` (How To Use steps + FAQ, help screen and Help Center
 *    archive alike) toggles `.open` from its `.acc-trigger`,
 *  - the Help Center page's back button gets its dedicated runtime a11y
 *    binding (role button / tabindex / 'Back to Settings' label / Enter +
 *    Space) — exactly as the source's support script did,
 *  - Help Center `.acc-trigger` rows get role/tabindex/aria-controls and a
 *    post-toggle aria-expanded sync (listener order preserved so the value
 *    reflects the state after the accordion toggle ran).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function initAccordion() {
    MF.dom.qa('.acc-item').forEach(function (item) {
      var trigger = item.querySelector('.acc-trigger');
      if (!trigger || trigger.dataset.accBound === '1') return;
      trigger.dataset.accBound = '1';
      trigger.addEventListener('click', function () {
        item.classList.toggle('open');
      });
    });
  }

  function initHelpcenterSupport() {
    var supportBack = document.querySelector('#page-helpcenter .back-btn');
    if (supportBack && supportBack.dataset.a11yBound !== '1') {
      supportBack.dataset.a11yBound = '1';
      supportBack.setAttribute('role', 'button');
      supportBack.setAttribute('aria-label', 'Back to Settings');
      supportBack.tabIndex = 0;
      supportBack.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); supportBack.click(); }
      });
      supportBack.addEventListener('click', function () { MF.settingsPages.close('helpcenter'); });
    }

    MF.dom.qa('#page-helpcenter .acc-trigger').forEach(function (trigger, i) {
      var answer = trigger.parentElement.querySelector('.acc-answer');
      if (!answer.id) answer.id = 'support-answer-' + i;
      trigger.setAttribute('role', 'button');
      trigger.tabIndex = 0;
      trigger.setAttribute('aria-controls', answer.id);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', function () {
        // Runs after the accordion toggle (bound first, as in the source),
        // so aria-expanded always reflects the post-toggle state.
        trigger.setAttribute('aria-expanded', String(trigger.parentElement.classList.contains('open')));
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
      });
    });
  }

  function init() {
    initAccordion();
    initHelpcenterSupport();
  }

  MF.helpPage = { init: init };
})(window);
