/* =========================================================================
 * UnavailableEngineAdapter — the truthful default when no engine is attached
 * -------------------------------------------------------------------------
 * NOT a fake/mock/demo engine (matrix §29). It performs no work, fabricates
 * no state and reports no progress. Every operational call rejects with
 * ENGINE_UNAVAILABLE so the UI can say exactly what is true: the engine is
 * not connected. Visual switch state, local settings persistence and log
 * console readiness continue to work through their own real stores.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var EngineError = MF.EngineError;

  var unavailable = {
    kind: 'unavailable',
    available: function () { return false; },
    info: function () {
      return { name: 'UnavailableEngineAdapter', version: '1.0.0', contractVersion: MF.engineContracts.ENGINE_ADAPTER_VERSION };
    },
    getStatus: function () {
      return Promise.resolve({ ready: false, detail: 'Engine not connected' });
    },
    getSettings: function () {
      // null = "no engine settings source" — the local store stays authoritative.
      return Promise.resolve(null);
    },
    setEngineEnabled: function () {
      return Promise.reject(new EngineError('ENGINE_UNAVAILABLE', 'Engine is not connected'));
    },
    execute: function () {
      return Promise.reject(new EngineError('ENGINE_UNAVAILABLE', 'Engine is not connected'));
    },
    subscribeLogs: function () {
      // No stream exists — return a harmless unsubscribe.
      return function () {};
    },
    cancel: function () {
      return Promise.reject(new EngineError('ENGINE_UNAVAILABLE', 'Engine is not connected'));
    }
  };

  MF.UnavailableEngineAdapter = unavailable;
})(window);
