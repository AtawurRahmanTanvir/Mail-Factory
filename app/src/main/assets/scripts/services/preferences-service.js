/* =========================================================================
 * MF.RatingService + MF.ThemeService — honest local state + config destinations
 * -------------------------------------------------------------------------
 * Rating (matrix §26): the star UI keeps its local selection state. This
 * service persists that choice for real and — only when config.links.rating
 * provides a real destination — routes the user there. Without a
 * destination it never claims an external submission.
 *
 * Theme (matrix §21): the Appearance page's Dark Red theme is the current
 * real theme. Other theme cards stay visually locked; selecting them is a
 * truthful "locked" state until real theme definitions exist. A future
 * theme pack registers definitions via registerTheme() — no UI rewrite.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var storage = MF.storage;

  MF.RatingService = {
    /** Persist the chosen rating locally (real, device-local state). */
    saveLocal: function (stars) {
      var n = Math.max(1, Math.min(5, Number(stars) || 0));
      return storage.setJson(MF.config.storage.rating, { stars: n, at: new Date().toISOString() });
    },
    getLocal: function () {
      return storage.getJson(MF.config.storage.rating, null);
    },
    /** Real destination configured? */
    hasDestination: function () { return typeof MF.config.links.rating === 'string' && !!MF.config.links.rating; },
    destination: function () { return MF.config.links.rating; }
  };

  var themes = {
    'dark-red': { name: 'Dark Red', locked: false } // the current, real theme
  };
  var themeListeners = [];

  MF.ThemeService = {
    /** Future theme packs register real definitions here. */
    registerTheme: function (id, definition) {
      if (!id || !definition || typeof definition.apply !== 'function') return false;
      themes[id] = Object.assign({ locked: false }, definition);
      themeListeners.slice().forEach(function (fn) { try { fn(); } catch (_) {} });
      return true;
    },
    isLocked: function (id) {
      var t = themes[id];
      return !t || !!t.locked;
    },
    name: function (id) {
      var t = themes[id];
      return t && t.name ? t.name : id;
    },
    /** Apply a theme if it genuinely exists; report locked otherwise. */
    select: function (id) {
      var t = themes[id];
      if (!t) return { applied: false, locked: true };
      if (t.locked) return { applied: false, locked: true };
      try { t.apply(); } catch (_) { /* theme failure must not break the page */ }
      return { applied: true, locked: false };
    }
  };
})(window);
