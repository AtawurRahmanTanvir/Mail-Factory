/* =========================================================================
 * MF.storage — defensive localStorage wrapper
 * -------------------------------------------------------------------------
 * Every read is validated/parse-guarded (matrix §42: "Validate/parse
 * defensively"). Storage failures never break the UI; they degrade to
 * in-memory only.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function safeGet(key) {
    try { return global.localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }
  function safeRemove(key) {
    try { global.localStorage.removeItem(key); return true; } catch (_) { return false; }
  }

  MF.storage = {
    /** Read and JSON.parse a key; returns `fallback` on any failure. */
    getJson: function (key, fallback) {
      var raw = safeGet(key);
      if (raw === null || typeof raw !== 'string') return fallback;
      try {
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (_) { return fallback; }
    },
    setJson: function (key, value) { return safeSet(key, JSON.stringify(value)); },
    getRaw: safeGet,
    setRaw: safeSet,
    remove: safeRemove,

    /** True when localStorage is usable at all (file:// private modes etc.). */
    available: (function () {
      try {
        var k = '__mf_probe__';
        global.localStorage.setItem(k, '1');
        global.localStorage.removeItem(k);
        return true;
      } catch (_) { return false; }
    })()
  };
})(window);
