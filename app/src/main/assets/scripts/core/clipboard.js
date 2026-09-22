/* =========================================================================
 * MF.clipboard — unified clipboard service
 * -------------------------------------------------------------------------
 * Consolidates the two near-identical copy implementations from the source
 * (generator `copyText` + library `copyLibraryText`) into one service with
 * the superset of their behaviours:
 *   1. async Clipboard API when in a secure context,
 *   2. legacy hidden-textarea + execCommand fallback (works on file://
 *      and older WebViews — this matters for the Android wrapper),
 *   3. focus restore after the fallback, aria-hidden on the helper node.
 * Copy feedback flashes (flashCopied / flashFailed / selectElementText)
 * are UI concerns and live here as presentation helpers, unchanged from
 * the source.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function legacyCopy(text) {
    var previous = document.activeElement;
    var field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.setAttribute('aria-hidden', 'true');
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(field);
    try {
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, text.length);
      return !!document.execCommand('copy');
    } catch (_) {
      return false;
    } finally {
      field.remove();
      try {
        if (previous && previous.focus) previous.focus({ preventScroll: true });
      } catch (_) { /* focus restore is best-effort */ }
    }
  }

  /** Promise<boolean> — true when the text was actually placed on the clipboard. */
  function copyText(text) {
    return new Promise(function (resolve) {
      if (global.isSecureContext && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(text).then(
          function () { resolve(true); },
          function () { resolve(legacyCopy(text)); }
        );
      } else {
        resolve(legacyCopy(text));
      }
    });
  }

  /** Select the full contents of an element (copy-failure fallback, from source). */
  function selectElementText(el) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = global.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (_) { return false; }
  }

  MF.clipboard = { copyText: copyText, selectElementText: selectElementText };

  // Compatibility: the source exposed copyText on window for Settings share
  // actions. Modules now call MF.clipboard.copyText directly.
  global.copyText = copyText;
})(window);
