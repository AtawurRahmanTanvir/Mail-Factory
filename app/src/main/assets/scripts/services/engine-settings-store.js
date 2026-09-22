/* =========================================================================
 * MF.EngineSettingsStore — engine settings: DESIRED vs NATIVE state
 * -------------------------------------------------------------------------
 * The source's toggleEngineSwitch mutated DOM classes only (matrix §9:
 * "visual switch state is not engine state"). This store keeps two
 * explicitly separate concepts:
 *
 *   DESIRED state (persisted)  — the user's local on/off intent per engine.
 *       get()/set()/all(): authoritative for what the user WANTS. Survives
 *       reloads. The switch UI renders THIS (so controls always reflect the
 *       user's real, persisted choice — never a claimed engine state).
 *
 *   NATIVE state (runtime only) — what the private engine has actually
 *       ACKNOWLEDGED via the contract. nativeState(id) returns
 *       undefined = UNKNOWN while no engine is connected (this app never
 *       pretends to know), true/false once the engine reports. It is
 *       deliberately NOT persisted: without a connected engine a stored
 *       "native" value would be a fabrication. markNative() is called by
 *       the engine integration layer when a real acknowledgement arrives.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var storage = MF.storage;
  var KEY = function () { return MF.config.storage.engineSettings; };

  var listeners = [];
  var settings = null;   // DESIRED state (persisted)
  var native = {};       // NATIVE state (runtime only; absent = unknown)

  function load() {
    settings = Object.assign({}, MF.config.engine.defaultSettings);
    var saved = storage.getJson(KEY(), null);
    if (saved && typeof saved === 'object') {
      Object.keys(settings).forEach(function (id) {
        if (typeof saved[id] === 'boolean') settings[id] = saved[id];
      });
    }
  }

  MF.EngineSettingsStore = {
    /** DESIRED state — the persisted local user intent (switch UI renders this). */
    get: function (id) { return !!settings[id]; },
    /** Desired-state snapshot. */
    all: function () { return Object.assign({}, settings); },
    /**
     * NATIVE state — engine-acknowledged value: true/false, or
     * undefined while UNKNOWN (no engine connected / no ack received).
     */
    nativeState: function (id) { return native[id]; },
    /** Record a real engine acknowledgement (integration layer only). */
    markNative: function (id, value) {
      if (!(id in settings)) return false;
      if (typeof value !== 'boolean') delete native[id];
      else native[id] = value;
      return true;
    },
    /** True only when the engine has acknowledged every setting. */
    isSyncedWithNative: function () {
      return Object.keys(settings).every(function (id) { return typeof native[id] === 'boolean'; });
    },
    set: function (id, value) {
      if (!(id in settings)) return false;
      settings[id] = !!value;
      storage.setJson(KEY(), settings);
      listeners.slice().forEach(function (fn) {
        try { fn(id, settings[id]); } catch (_) {}
      });
      return true;
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    }
  };

  load();
})(window);
