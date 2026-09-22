/* =========================================================================
 * MF.toast — global transient feedback service
 * -------------------------------------------------------------------------
 * Same behaviour/visuals as the source showToast (2s visibility, timer
 * reset on re-show). What changed is discipline about WHAT is shown:
 * messages are truthful states, never fake success and never placeholder
 * promises (matrix §32, §34).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var HIDE_MS = 2000; // REAL — source timing

  var hideTimer = null;

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { t.classList.remove('show'); }, HIDE_MS);
  }

  /** Truthful standard messages (single place, easy to audit). */
  var messages = {
    engineNotConnected: 'Engine is not connected',
    generatorNotConnected: 'Generation engine is not connected',
    nothingToCopy: 'Nothing to copy',
    linkNotConfigured: function (name) { return name + ' link is not configured yet'; },
    emailNotConfigured: 'Contact email is not configured yet', // REAL — wording from source
    ratingSaved: 'Rating saved on this device',
    ratingDestinationMissing: 'Ratings destination is not configured yet',
    backupNotConnected: function (name) { return name + ': no backup provider is connected'; },
    themeLocked: function (name) { return name + ' theme is locked'; }
  };

  MF.toast = { show: showToast, messages: messages };
  // The source exposed window.showToast (used by inline handlers and modules).
  global.showToast = showToast;
})(window);
