/* =========================================================================
 * MF.NetworkCheckService — the real Check Route network probe
 * -------------------------------------------------------------------------
 * Carried over from the source VERBATIM in behaviour: a genuine fetch to a
 * configured reachability target with a hard timeout, measured with
 * performance.now(). This was real browser functionality in the source
 * (matrix §7: "Do not classify the entire page as fake") and stays real —
 * only the target/timings moved into config.
 *
 * When the product later decides this belongs to the native engine, the
 * page can call MF.engine.execute('checkRoute') instead — the UI contract
 * does not change.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function check() {
    var cfg = MF.config.network.routeCheck;
    var start = performance.now();
    return Promise.race([
      fetch(cfg.targetUrl, { mode: 'no-cors', cache: 'no-store' }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timeout')); }, cfg.timeoutMs);
      })
    ]).then(function () {
      return { ok: true, elapsedMs: Math.round(performance.now() - start) };
    }, function () {
      return { ok: false, elapsedMs: Math.round(performance.now() - start) };
    });
  }

  MF.NetworkCheckService = {
    check: check,
    targetHost: function () { return MF.config.network.routeCheck.targetHost; }
  };
})(window);
