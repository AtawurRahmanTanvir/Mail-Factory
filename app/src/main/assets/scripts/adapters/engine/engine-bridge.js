/* =========================================================================
 * EngineBridge — detection layer for the future native engine
 * -------------------------------------------------------------------------
 * Android integration path (docs/ARCHITECTURE.md §Engine boundary):
 *
 *   Web UI → EngineBridge (here) → window.MailFactoryEngine (Android
 *   JavascriptInterface) → Kotlin/C++ → private engine
 *
 * The native side will inject an object named `window.MailFactoryEngine`
 * exposing JSON-string based methods matching the contract in
 * engine-adapter.js. This module wraps it into the async adapter shape and
 * validates the contract version at attach time. Until such an object is
 * injected this module is inert — it never simulates the native side.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var REQUIRED_METHODS = ['getStatus', 'getSettings', 'setEngineEnabled', 'execute', 'subscribeLogs'];

  /**
   * Build an EngineAdapter around a native bridge object, or return null
   * when no compatible bridge exists.
   */
  function detect() {
    var native = global.MailFactoryEngine;
    if (!native) return null;

    // Contract handshake — the native side reports the contract it speaks.
    var contractVersion = 0;
    try {
      contractVersion = native.getContractVersion();
    } catch(e) {
      try {
        contractVersion = native.contractVersion || 0;
      } catch(e2) {}
    }

    if (contractVersion !== MF.engineContracts.ENGINE_ADAPTER_VERSION) {
      if (MF.toast) MF.toast.show('Engine bridge version mismatch: ' + contractVersion);
      return null;
    }

    function callJson(method) {
      var args = Array.prototype.slice.call(arguments, 1).map(function (a) {
        return JSON.stringify(a);
      });
      return new Promise(function(resolve, reject) {
        try {
          var raw;
          if (args.length === 0) raw = native[method]();
          else if (args.length === 1) raw = native[method](args[0]);
          else if (args.length === 2) raw = native[method](args[0], args[1]);
          else throw new Error("Too many arguments");
          resolve(raw);
        } catch(e) {
          reject(e);
        }
      }).then(function (raw) {
        if (typeof raw === 'string' && raw) {
          try { return JSON.parse(raw); } catch (_) {
            throw new MF.EngineError('INVALID_RESPONSE', 'Engine bridge returned malformed JSON');
          }
        }
        return raw;
      });
    }

    var callbackCounter = 0;
    global.__mfCallbacks = {};
    global.__mfResolve = function(id, data) {
      if(global.__mfCallbacks[id]) {
        global.__mfCallbacks[id].resolve(data);
        delete global.__mfCallbacks[id];
      }
    };
    global.__mfReject = function(id, err) {
      if(global.__mfCallbacks[id]) {
        global.__mfCallbacks[id].reject(err);
        delete global.__mfCallbacks[id];
      }
    };

    function callJsonAsync(method, payloadObj) {
      return new Promise(function(resolve, reject) {
        var id = 'cb_' + (++callbackCounter);
        global.__mfCallbacks[id] = { resolve: resolve, reject: reject };
        try {
          if (method === 'execute') {
            native.executeAsync(JSON.stringify(payloadObj), id);
          } else {
            // fallback
            native[method + 'Async'](JSON.stringify(payloadObj), id);
          }
        } catch (e) {
          reject(e);
        }
      }).then(function(raw) {
        if (typeof raw === 'string' && raw) {
          try { return JSON.parse(raw); } catch (_) {
            throw new MF.EngineError('INVALID_RESPONSE', 'Engine bridge returned malformed JSON');
          }
        }
        return raw;
      });
    }

    return {
      kind: 'bridge',
      available: function () { return true; },
      info: function () {
        return {
          name: (typeof native.getName === 'function' || native.getName) ? native.getName() : 'MailFactoryEngine',
          version: (typeof native.getVersion === 'function' || native.getVersion) ? native.getVersion() : (typeof native.version === 'string' ? native.version : 'unknown'),
          contractVersion: contractVersion
        };
      },
      getStatus: function () { return callJson('getStatus'); },
      getSettings: function () { return callJson('getSettings'); },
      setEngineEnabled: function (id, enabled) {
        return callJson('setEngineEnabled', { id: id, enabled: !!enabled });
      },
      execute: function (command, payload) {
        return callJsonAsync('execute', { command: command, payload: payload || null });
      },
      subscribeLogs: function (listener) {
        // Native pushes by invoking window.__mfEngineLog (installed below).
        global.__mfEngineLog = function (raw) {
          try {
            var entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (entry && typeof entry.text === 'string') listener(entry);
          } catch (_) { /* malformed engine event — ignored, never fabricated */ }
        };
        try { native.subscribeLogs('__mfEngineLog'); } catch (_) { /* noop */ }
        return function () {
          try { native.unsubscribeLogs && native.unsubscribeLogs('__mfEngineLog'); } catch (_) {}
          delete global.__mfEngineLog;
        };
      },
      cancel: function (operationId) { return callJson('cancel', { operationId: operationId }); }
    };
  }

  MF.EngineBridge = { detect: detect };
})(window);
