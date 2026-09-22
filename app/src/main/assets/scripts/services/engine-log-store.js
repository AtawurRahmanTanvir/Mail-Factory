/* =========================================================================
 * MF.EngineLogStore — event-sourced log buffer for the Log Engine console
 * -------------------------------------------------------------------------
 * Data flow (matrix §10):
 *   Engine Event → adapter subscribeLogs → this store → Log UI
 *
 * There are NO timers and NO simulated activity here. Entries enter the
 * store only when an adapter pushes a real event, or when the UI itself has
 * something true to say (a single "console ready" line when the page
 * opens). The UI derives the LIVE/IDLE badge and activity-dot motion from
 * stream state — never implying activity that is not happening.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var MAX_ENTRIES = 200;
  var entries = [];
  var listeners = [];
  var streamConnected = false;

  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(entries, streamConnected); } catch (_) {}
    });
  }

  MF.EngineLogStore = {
    /** Push one real event: {tag, text, level:'ok'|'info'|'error', time?}. */
    push: function (entry) {
      if (!entry || typeof entry.text !== 'string') return;
      entries.push({
        tag: typeof entry.tag === 'string' && entry.tag ? entry.tag : 'SYSTEM',
        text: entry.text,
        level: entry.level === 'ok' || entry.level === 'error' ? entry.level : 'info',
        time: typeof entry.time === 'string' ? entry.time : new Date().toISOString()
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      emit();
    },

    /** Attach a real engine event stream. Returns a detach function. */
    connectStream: function (subscribeFn) {
      if (typeof subscribeFn !== 'function') return function () {};
      var unsubscribe = subscribeFn(function (entry) { MF.EngineLogStore.push(entry); });
      streamConnected = true;
      emit();
      return function () {
        streamConnected = false;
        try { unsubscribe(); } catch (_) {}
        emit();
      };
    },

    /** True only while a real engine stream is attached. */
    isStreamConnected: function () { return streamConnected; },

    getEntries: function () { return entries.slice(); },

    clear: function () { entries = []; emit(); },

    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    }
  };
})(window);
