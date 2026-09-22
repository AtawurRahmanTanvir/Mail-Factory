/* =========================================================================
 * MF.engine — EngineService facade (the only engine entry point the UI uses)
 * -------------------------------------------------------------------------
 * Resolves the active adapter at boot:
 *   1. a custom adapter registered via MF.engine.registerAdapter()
 *      (native integrations may call this before pages initialize),
 *   2. the Android bridge (window.MailFactoryEngine) when injected,
 *   3. otherwise the UnavailableEngineAdapter — the UI then reports the
 *      truthful "engine is not connected" state everywhere.
 *
 * UI modules call MF.engine.execute(command, payload) and handle a rejected
 * promise with code ENGINE_UNAVAILABLE by showing the truthful message.
 * No module ever fakes a successful engine outcome.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var EngineError = MF.EngineError;

  var customAdapter = null;
  var resolved = null;
  var statusListeners = [];
  var logDetach = null;

  function resolveAdapter() {
    if (customAdapter) return customAdapter;
    var bridge = MF.EngineBridge.detect();
    if (bridge) return bridge;
    return MF.UnavailableEngineAdapter;
  }

  function adapter() {
    if (!resolved) {
      resolved = resolveAdapter();
      // Forward real engine events into the log store.
      if (logDetach) { try { logDetach(); } catch (_) {} logDetach = null; }
      if (resolved.available()) {
        logDetach = MF.EngineLogStore.connectStream(function (listener) {
          return resolved.subscribeLogs(listener);
        });
      }
    }
    return resolved;
  }

  MF.engine = {
    /** Register a custom adapter (native shells may call this early). */
    registerAdapter: function (adapterObj) {
      if (!adapterObj || typeof adapterObj.execute !== 'function' ||
          typeof adapterObj.available !== 'function') {
        throw new EngineError('INVALID_ADAPTER', 'Adapter must implement available() and execute()');
      }
      customAdapter = adapterObj;
      resolved = null; // force re-resolution
    },

    adapter: adapter,
    isAvailable: function () { return adapter().available(); },
    info: function () { return adapter().info(); },

    /** Promise<EngineStatus> — ready:true only from a real engine. */
    getStatus: function () { return adapter().getStatus(); },

    /**
     * Execute an engine command. Rejects with EngineError; the UI maps
     * codes to truthful feedback (never fake success).
     */
    execute: function (command, payload) {
      var a = adapter();
      if (!a.available()) {
        return Promise.reject(new EngineError('ENGINE_UNAVAILABLE', 'Engine is not connected'));
      }
      return a.execute(command, payload);
    },

    /**
     * Engine settings: local store is authoritative for the UI; the adapter
     * is informed when one exists (fire-and-forget; failure is logged to
     * the console, never faked in the UI).
     */
    getSettings: function () { return adapter().getSettings(); },
    setEngineEnabled: function (id, enabled) {
      var a = adapter();
      if (!a.available()) return Promise.resolve({ local: true });
      return a.setEngineEnabled(id, enabled).catch(function (err) {
        // Surface honestly in the log store; the switch stays truthfully local.
        MF.EngineLogStore.push({
          tag: 'SETTINGS', level: 'error',
          text: 'Engine rejected setting change: ' + (err && err.message ? err.message : 'unknown error')
        });
        throw err;
      });
    },

    onStatusChanged: function (fn) {
      statusListeners.push(fn);
      return function () {
        var i = statusListeners.indexOf(fn);
        if (i !== -1) statusListeners.splice(i, 1);
      };
    }
  };
})(window);
