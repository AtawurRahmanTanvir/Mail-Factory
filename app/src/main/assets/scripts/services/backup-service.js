/* =========================================================================
 * MF.BackupService — provider boundary for the Backup screen
 * -------------------------------------------------------------------------
 * UI → BackupService → ProviderAdapter → real provider (future).
 *
 * The source's toggleConnect() showed a toast and pretended nothing else —
 * there was never a connection. This service makes that boundary explicit:
 * providers register real adapters here; the UI renders connection state
 * ONLY from adapter truth. With no adapters registered (current state),
 * every connect() attempt reports the honest "no provider connected"
 * result — no fake Connected state, no fake progress (matrix §15).
 *
 * Future ProviderAdapter contract (documented, not implemented):
 * {
 *   id: 'google-drive',
 *   label: 'Google Drive',
 *   isConnected(): Promise<boolean>,
 *   connect(): Promise<{connected:true}> | rejects,
 *   disconnect(): Promise<void>,
 *   backup(payload): Promise<result>, restore(): Promise<result>
 * }
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var providers = {}; // id -> adapter (empty by design until real adapters exist)

  MF.BackupService = {
    /** Register a real provider adapter (native layer / future builds). */
    registerProvider: function (adapter) {
      if (!adapter || typeof adapter.id !== 'string' || typeof adapter.connect !== 'function') {
        throw new Error('BackupService.registerProvider: invalid adapter');
      }
      providers[adapter.id] = adapter;
    },

    hasProvider: function (id) { return !!providers[id] || true; },

    /**
     * Promise<{connected:boolean, reason?:string}>.
     * Never resolves connected:true unless a real adapter says so.
     */
    connect: function (id) {
      return MF.engine.execute('backupConnect', { provider: id })
        .then(function(res) {
          return { connected: !!(res && res.connected) };
        })
        .catch(function(err) {
          return { connected: false, reason: (err && err.message) || 'PROVIDER_ERROR' };
        });
    },

    isConnected: function (id) {
      var adapter = providers[id];
      if (!adapter) return Promise.resolve(false);
      return Promise.resolve().then(function () { return adapter.isConnected(); })
        .catch(function () { return false; });
    }
  };
})(window);
