/* =========================================================================
 * Mail Factory — Generator screen controller
 * -------------------------------------------------------------------------
 * The full Generator UI is preserved (tabs, steppers, preset menus, name
 * counters, output cards, copy interactions — matrix §10/§11). What is gone
 * is the fake production path: the source's random generators (randChar,
 * genEmail, genPassword…) no longer exist anywhere.
 *
 * GENERATE now builds a typed request and delegates to the engine contract:
 *   button → GeneratorService.generate() → MF.engine.execute()
 * While no engine is attached the button reports the truthful "Generation
 * engine is not connected" state and the output area stays empty. When a
 * real engine is integrated, results render through the exact same output
 * UI and are stored into the Library via LibraryRepository (the behaviour
 * the app's own Notifications page documents).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  /* ---------- tabs (source parity) ---------- */
  function initTabs() {
    var tabs = MF.dom.qa('#screen-generator .tab');
    var views = MF.dom.qa('#screen-generator [data-view]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var name = tab.dataset.tab;
        views.forEach(function (v) { v.classList.toggle('active', v.dataset.view === name); });
        closeAllMenus();
      });
    });
  }

  /* ---------- steppers (single tab, source parity) ---------- */
  function initSteppers() {
    MF.dom.qa('#screen-generator .stepper button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.dataset.target);
        var v = parseInt(input.value || '0', 10) + parseInt(btn.dataset.dir, 10);
        v = Math.max(4, Math.min(40, v));
        input.value = v;
      });
    });
  }

  /* ---------- preset dropdown menus (batch tab, source parity) ---------- */
  function closeAllMenus() {
    MF.dom.qa('#screen-generator .preset-menu').forEach(function (m) { m.classList.remove('open'); });
  }
  function initPresetMenus() {
    MF.dom.qa('#screen-generator .chevron-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = document.getElementById(btn.dataset.menu);
        var wasOpen = menu.classList.contains('open');
        closeAllMenus();
        if (!wasOpen) menu.classList.add('open');
      });
    });
    MF.dom.qa('#screen-generator .preset-menu button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById(btn.dataset.set).value = btn.dataset.val;
        closeAllMenus();
      });
    });
    document.addEventListener('click', closeAllMenus);
  }

  /* ---------- name pattern counters (source parity) ---------- */
  function bindCounter(inputId, countId) {
    var input = document.getElementById(inputId);
    var count = document.getElementById(countId);
    input.addEventListener('input', function () { count.textContent = input.value.length; });
  }

  /* ---------- output rendering (real engine results only) ---------- */

  function renderSingleResult(items) {
    var item = items[0];
    var emailOut = document.getElementById('s-email-out');
    var passOut = document.getElementById('s-pass-out');
    emailOut.textContent = item.email;
    passOut.textContent = item.password;
    emailOut.classList.add('filled');
    passOut.classList.add('filled');
    var sOutput = document.getElementById('s-output');
    sOutput.classList.add('revealed');
    setTimeout(function () { sOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 200);
  }

  function renderBatchResult(items) {
    var batchList = document.getElementById('batchList');
    var bOutput = document.getElementById('b-output');
    batchList.innerHTML = '';
    items.forEach(function (item, i) {
      var row = MF.dom.fromHtml(
        '<div class="batch-item">' +
          '<span class="batch-dot"></span>' +
          '<span class="batch-text"></span>' +
          '<button class="batch-copy" data-index="' + i + '" aria-label="copy">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '</button>' +
        '</div>');
      // email / password are interpolated through textContent — never raw HTML.
      var text = MF.dom.qa('.batch-text', row);
      var emailSpan = document.createElement('span');
      emailSpan.textContent = item.email;
      var sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '|';
      var passSpan = document.createElement('span');
      passSpan.textContent = item.password;
      text[0].appendChild(emailSpan);
      text[0].appendChild(sep);
      text[0].appendChild(passSpan);
      batchList.appendChild(row);
    });
    bindBatchCopyButtons(items);
    document.getElementById('b-count').textContent = String(items.length);
    bOutput.classList.add('revealed');
    setTimeout(function () { bOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 200);
  }

  var currentBatch = []; // transient result state for Copy All (source concept)

  function bindBatchCopyButtons(items) {
    MF.dom.qa('#batchList .batch-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var it = items[parseInt(btn.dataset.index, 10)];
        var row = btn.closest('.batch-item');
        var textEl = row ? row.querySelector('.batch-text') : null;
        MF.clipboard.copyText(it.email + ' | ' + it.password).then(function (ok) {
          if (ok) flashCopied(btn, null);
          else { if (textEl) MF.clipboard.selectElementText(textEl); flashFailed(btn, null); }
        });
      });
    });
  }

  /* ---------- copy feedback flashes (source parity) ---------- */
  function flashCopied(btn, labelSel) {
    btn.classList.remove('copy-failed');
    btn.classList.add('copied');
    var label = labelSel ? btn.querySelector(labelSel) : null;
    var original = label ? label.dataset.orig || label.textContent : null;
    if (label) { if (!label.dataset.orig) label.dataset.orig = label.textContent; label.textContent = 'COPIED'; }
    setTimeout(function () {
      btn.classList.remove('copied');
      if (label) label.textContent = original;
    }, 1200);
  }
  function flashFailed(btn, labelSel) {
    btn.classList.remove('copied');
    btn.classList.add('copy-failed');
    var label = labelSel ? btn.querySelector(labelSel) : null;
    var original = label ? label.dataset.orig || label.textContent : null;
    if (label) { if (!label.dataset.orig) label.dataset.orig = label.textContent; label.textContent = 'SELECTED'; }
    setTimeout(function () {
      btn.classList.remove('copy-failed');
      if (label) label.textContent = original;
    }, 1600);
  }

  /* ---------- generate actions (engine contract) ---------- */

  function generateSingle() {
    var request = MF.GeneratorService.buildSingleRequest({
      namePattern: document.getElementById('s-name').value,
      emailLength: document.getElementById('s-email-len').value,
      passwordLength: document.getElementById('s-pass-len').value
    });
    MF.GeneratorService.generate(request).then(function (result) {
      renderSingleResult(result.items);
      // Real result → real Library record (documented product data flow).
      MF.LibraryRepository.addSingle({
        email: result.items[0].email,
        password: result.items[0].password
      });
    }).catch(function () {
      MF.toast.show(MF.toast.messages.generatorNotConnected);
    });
  }

  function generateBatch() {
    var request = MF.GeneratorService.buildBatchRequest({
      namePattern: document.getElementById('b-name').value,
      emailLength: document.getElementById('b-email-len').value,
      passwordLength: document.getElementById('b-pass-len').value,
      quantity: document.getElementById('b-qty').value
    });
    MF.GeneratorService.generate(request).then(function (result) {
      currentBatch = result.items;
      renderBatchResult(currentBatch);
      MF.LibraryRepository.addBatch(request.namePattern || null, currentBatch);
    }).catch(function () {
      MF.toast.show(MF.toast.messages.generatorNotConnected);
    });
  }

  /* ---------- copy single ---------- */
  function initSingleCopy() {
    MF.dom.qa('#screen-generator .copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var el = document.getElementById(btn.dataset.copy);
        var val = el.textContent;
        if (!val) { MF.toast.show(MF.toast.messages.nothingToCopy); return; }
        MF.clipboard.copyText(val).then(function (ok) {
          if (ok) flashCopied(btn, '.copy-label');
          else { MF.clipboard.selectElementText(el); flashFailed(btn, '.copy-label'); }
        });
      });
    });
  }

  /* ---------- copy all (real transient batch only) ---------- */
  function initCopyAll() {
    var btn = document.getElementById('copyAllBtn');
    btn.addEventListener('click', function () {
      if (!currentBatch.length) { MF.toast.show(MF.toast.messages.nothingToCopy); return; }
      var self = this;
      var text = currentBatch.map(function (it) { return it.email + ' | ' + it.password; }).join('\n');
      MF.clipboard.copyText(text).then(function (ok) {
        if (ok) {
          self.style.color = '#3ddc84';
          self.style.borderColor = 'rgba(61,220,132,0.5)';
        } else {
          MF.clipboard.selectElementText(document.getElementById('batchList'));
          self.style.color = '#f5a623';
          self.style.borderColor = 'rgba(245,166,35,0.5)';
        }
        setTimeout(function () { self.style.color = ''; self.style.borderColor = ''; }, 1600);
      });
    });
  }

  function init() {
    initTabs();
    initSteppers();
    initPresetMenus();
    bindCounter('s-name', 's-name-count');
    bindCounter('b-name', 'b-name-count');
    initSingleCopy();
    initCopyAll();
    document.getElementById('genSingleBtn').addEventListener('click', generateSingle);
    document.getElementById('genBatchBtn').addEventListener('click', generateBatch);
  }

  MF.generatorPage = { init: init, closeAllMenus: closeAllMenus };
})(window);
