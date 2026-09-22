/* =========================================================================
 * Mail Factory — Engine screen controller
 * -------------------------------------------------------------------------
 * Owns the three dedicated Engine sub-pages (Check Route / Log Engine /
 * System Settings) plus the System Settings switches.
 *
 * Honest-state rules implemented here (matrix §6–§10):
 *  - Check Route keeps its REAL network check + clock (config-driven target).
 *  - Log Engine renders entries from EngineLogStore only; the fabricated
 *    startup lines are gone. LIVE/IDLE badge and activity dots are bound to
 *    real stream state.
 *  - System Settings switches are bound to EngineSettingsStore (persisted)
 *    and mirrored to the engine when one is attached.
 *  - OPTIMIZE SYSTEM / CREATE ACCOUNT carry data-engine-action and are
 *    handled by the shared .btn binder (truthful "not connected" feedback
 *    until the private engine is integrated).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  /* ---------------- sub-page open/close (source parity) ---------------- */

  function openEngineSubpage(id) {
    var el = document.getElementById('engpage-' + id);
    if (!el) return;
    el.classList.add('open');
    if (id === 'checkroute') initCheckRoutePage();
    if (id === 'logengine') initLogEnginePage();
  }

  function closeEngineSubpage(id) {
    var el = document.getElementById('engpage-' + id);
    if (!el) return;
    el.classList.remove('open');
    if (id === 'checkroute' && crClockTimer) {
      clearInterval(crClockTimer);
      crClockTimer = null;
    }
    if (id === 'logengine') detachLogPage();
  }

  /* ---------------- CHECK ROUTE (real web behaviour, from source) ------- */

  var crClockTimer = null;
  var crInited = false;
  var crChecking = false;

  function crUpdateOnlineState() {
    var dot = document.getElementById('crStatusDot');
    var txt = document.getElementById('crStatusText');
    if (!dot || !txt) return;
    var online = navigator.onLine;
    dot.classList.toggle('offline', !online);
    txt.classList.toggle('offline', !online);
    txt.textContent = online ? 'ONLINE' : 'OFFLINE';
  }

  function crTickClock() {
    var clockEl = document.getElementById('crClock');
    var dateEl = document.getElementById('crDate');
    if (!clockEl || !dateEl) return;
    var now = new Date();
    clockEl.textContent = MF.dom.clock.time(now);
    dateEl.textContent = MF.dom.clock.date(now);
  }

  function initCheckRoutePage() {
    crUpdateOnlineState();
    crTickClock();
    if (!crInited) {
      window.addEventListener('online', crUpdateOnlineState);
      window.addEventListener('offline', crUpdateOnlineState);
      crInited = true;
    }
    if (crClockTimer) clearInterval(crClockTimer);
    crClockTimer = setInterval(crTickClock, 1000);
  }

  function runRouteCheck() {
    if (crChecking) return;
    crChecking = true;
    var cfg = MF.config.network.routeCheck;
    var btn = document.getElementById('crCheckBtn');
    var label = document.getElementById('crBtnLabel');
    var anim = document.getElementById('crRouteAnim');
    var statusEl = document.getElementById('crRouteStatus');
    var latEl = document.getElementById('crLatency');
    var routeEl = document.getElementById('crRoute');
    var lastEl = document.getElementById('crLastChecked');

    btn.classList.add('checking');
    btn.disabled = true;
    label.textContent = 'CHECKING…';
    anim.classList.remove('done');
    anim.classList.add('checking');
    statusEl.textContent = 'CHECKING…';
    statusEl.className = 'rv';
    latEl.textContent = '—';

    var minDuration = new Promise(function (res) { setTimeout(res, cfg.minDurationMs); });
    var startedAt = performance.now();

    MF.NetworkCheckService.check().then(function (result) {
      var elapsed = result && typeof result.elapsedMs === 'number'
        ? result.elapsedMs : Math.round(performance.now() - startedAt);
      return minDuration.then(function () { return { ok: !!result.ok, elapsed: elapsed }; });
    }).then(function (r) {
      anim.classList.remove('checking');
      anim.classList.add('done');
      btn.classList.remove('checking');
      btn.disabled = false;
      label.textContent = 'CHECK ROUTE';

      if (r.ok) {
        statusEl.textContent = 'CONNECTED';
        statusEl.className = 'rv good';
        latEl.textContent = r.elapsed + ' ms';
        latEl.className = 'rv ' + (r.elapsed < 300 ? 'good' : '');
      } else {
        statusEl.textContent = 'FAILED';
        statusEl.className = 'rv bad';
        latEl.textContent = '—';
      }
      routeEl.textContent = MF.NetworkCheckService.targetHost();
      lastEl.textContent = MF.dom.clock.time(new Date());
      crChecking = false;
    });
  }

  /* ---------------- LOG ENGINE (event-stream driven) -------------------- */

  var logUnsubscribe = null;
  var logStreamDetach = null;

  function renderLogConsole(entries, streamConnected) {
    var consoleEl = document.getElementById('logConsole');
    if (!consoleEl) return;
    var cursorRow = consoleEl.querySelector('.log-cursor-row');
    var activity = consoleEl.querySelector('.log-activity');

    // Drop previously rendered event lines (everything but cursor + activity).
    MF.dom.qa('.log-line', consoleEl).forEach(function (line) { line.remove(); });

    entries.forEach(function (entry) {
      var line = document.createElement('div');
      line.className = 'log-line' + (entry.level === 'ok' ? ' ok' : '');
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '[' + entry.tag + ']';
      line.appendChild(tag);
      line.appendChild(document.createTextNode(' ' + entry.text));
      consoleEl.insertBefore(line, cursorRow);
    });

    // Badge + dots tell the truth: LIVE only while a real stream is attached.
    // When idle the pulse dot and activity bars are frozen via inline styles
    // (no stylesheet change) so nothing implies activity that isn't happening.
    var badge = document.getElementById('logLiveBadge');
    if (badge) {
      badge.textContent = streamConnected ? 'LIVE' : 'IDLE';
      var dot = badge.querySelector('.dot');
      if (dot) dot.style.animationPlayState = streamConnected ? 'running' : 'paused';
    }
    if (activity) {
      MF.dom.qa('span', activity).forEach(function (bar) {
        bar.style.animationPlayState = streamConnected ? 'running' : 'paused';
      });
    }
  }

  function initLogEnginePage() {
    var consoleEl = document.getElementById('logConsole');
    if (!consoleEl || consoleEl.dataset.logInit === '1') { return; }
    consoleEl.dataset.logInit = '1';

    // One truthful UI line — the console itself is ready and waiting for a
    // real engine stream. Pushed once per session (not per page open), so
    // re-entering the page never fabricates duplicate "ready" events.
    var existing = MF.EngineLogStore.getEntries();
    var hasReadyLine = existing.some(function (e) {
      return e.tag === 'UI' && e.text.indexOf('Console ready') === 0;
    });
    if (!hasReadyLine) {
      MF.EngineLogStore.push({
        tag: 'UI', level: 'info',
        text: 'Console ready — waiting for engine events'
      });
    }

    if (MF.engine.isAvailable()) {
      // Ensure the engine stream is connected through the facade.
      MF.engine.getStatus().catch(function () { /* truthful: status unavailable */ });
    }

    logUnsubscribe = MF.EngineLogStore.subscribe(renderLogConsole);
    renderLogConsole(MF.EngineLogStore.getEntries(), MF.EngineLogStore.isStreamConnected());
  }

  function detachLogPage() {
    if (logUnsubscribe) { logUnsubscribe(); logUnsubscribe = null; }
    var consoleEl = document.getElementById('logConsole');
    if (consoleEl) delete consoleEl.dataset.logInit;
  }

  /* ---------------- SYSTEM SETTINGS (engine switches) ------------------- */

  function applySwitchUi(id, on) {
    var el = document.getElementById('sw-' + id);
    if (!el) return;
    el.classList.toggle('on', on);
    el.setAttribute('role', 'switch');
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    var statusEl = document.querySelector('[data-status-for="sw-' + id + '"]');
    if (statusEl) {
      statusEl.textContent = on ? 'ON' : 'OFF';
      statusEl.classList.toggle('on', on);
    }
  }

  function initEngineSwitches() {
    Object.keys(MF.config.engine.defaultSettings).forEach(function (id) {
      applySwitchUi(id, MF.EngineSettingsStore.get(id));

      var el = document.getElementById('sw-' + id);
      if (!el || el.dataset.switchBound === '1') return;
      el.dataset.switchBound = '1';
      el.addEventListener('click', function () {
        var next = !MF.EngineSettingsStore.get(id);
        // DESIRED state: real, persisted, rendered by the switch.
        MF.EngineSettingsStore.set(id, next);
        applySwitchUi(id, next);
        // NATIVE state stays UNKNOWN while no engine is connected; when a
        // real engine acknowledges the change, record it. local:true means
        // "no engine attached — desired state stored, nothing claimed".
        MF.engine.setEngineEnabled(id, next).then(function (result) {
          if (result && result.local) return;         // honest: engine not connected
          MF.EngineSettingsStore.markNative(id, next); // real acknowledgement
        }).catch(function () { /* engine rejected — desired state stays, native unknown */ });
      });
    });
  }

  /* ---------------- module init ------------------------------------------ */

  function init() {
    // Bind controls (inline handlers were removed from the markup).
    MF.dom.qa('[data-action="open-engine-subpage"]').forEach(function (el) {
      el.addEventListener('click', function () { openEngineSubpage(el.dataset.page); });
    });
    MF.dom.qa('[data-action="close-engine-subpage"]').forEach(function (el) {
      el.addEventListener('click', function () { closeEngineSubpage(el.dataset.page); });
    });
    var checkBtn = document.getElementById('crCheckBtn');
    if (checkBtn) checkBtn.addEventListener('click', runRouteCheck);

    initEngineSwitches();
  }

  MF.enginePage = {
    init: init,
    openSubpage: openEngineSubpage,
    closeSubpage: closeEngineSubpage
  };

  // Compatibility names used by tests/tools (source had these on window).
  global.openEngineSubpage = openEngineSubpage;
  global.closeEngineSubpage = closeEngineSubpage;
  global.toggleEngineSwitch = function (el) { el.click(); };
})(window);
