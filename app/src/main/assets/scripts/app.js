/* =========================================================================
 * Mail Factory — application boot
 * -------------------------------------------------------------------------
 * Wires every page controller to the assembled DOM. Load order is defined
 * by the <script> sequence in index.html (see docs/ARCHITECTURE.md):
 *
 *   app-config → core/{dom,storage,clipboard,toast} →
 *   adapters/engine/{engine-adapter,unavailable-engine-adapter,engine-bridge} →
 *   data/library-repository →
 *   services/{engine-settings-store, engine-log-store, engine-service,
 *             generator-service, network-check-service, release-service,
 *             backup-service, preferences-service} →
 *   core/{router, interactions, accessibility} →
 *   pages/{dashboard, engine, generator, library, settings, help, one-touch} →
 *   this file.
 *
 * Every controller binds its own DOM; nothing here contains page logic.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function boot() {
      MF.enginePage.init();       // Engine screen + sub-pages + switches
      MF.generatorPage.init();    // Generator UI (engine-contract generation)
      MF.libraryPage.init();      // Library (repository-driven)
      MF.settingsPages.init();    // Settings + all sub-pages + version modal
      MF.helpPage.init();         // Accordions + Help Center a11y
      MF.interactions.init();     // nav wiring + ripple/zap + engine actions
      MF.a11y.init();             // keyboard semantics for div controls

      // ম্যাজিক ট্রিক: ড্যাশবোর্ড ওপেন হওয়ার ২.৫ সেকেন্ড পর ব্যাকগ্রাউন্ডে One Touch সাইলেন্টলি লোড হয়ে যাবে!
      setTimeout(function() {
          if (MF.oneTouch && MF.oneTouch.mount) {
              MF.oneTouch.mount();
          }
      }, 2500);
    }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  MF.boot = boot;
})(window);
