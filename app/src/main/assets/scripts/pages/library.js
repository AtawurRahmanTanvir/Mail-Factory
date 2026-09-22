/* =========================================================================
 * Mail Factory — Library screen controller
 * -------------------------------------------------------------------------
 * The complete Library UX is preserved (search, clear search, six sort
 * modes, batch expansion, star/verify/rename/delete, long-press sub-account
 * menu, sheets, copy controls, total counter, entry animations). Every
 * pixel of card markup mirrors the source templates.
 *
 * What changed is the data path (matrix §11–§15):
 *   BEFORE: hardcoded demo cards + DOM-as-database + synthetic rows
 *   NOW:    LibraryRepository (single authoritative store) → this renderer
 *
 * Removed fabrication:
 *   - the five hardcoded demo cards and the fake "258" total,
 *   - toggleViewAll's synthetic row generator and batchExpectedEmails()
 *     synthesis (search matches only real stored members now),
 *   - the "••••••••••" pseudo-credentials presented as data (a password is
 *     shown/copied only when a real record carries one).
 * The Library therefore opens EMPTY and fills from real records only.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var list;                       // #list container
  var currentSort = 'newest';     // REAL — source default
  var searchQuery = '';           // view state
  var currentCardId = null;       // context-menu target
  var currentSubitem = null;      // { batchId, index } context-menu target
  var presearchExpansion = {};    // batchId -> '1'|'0' snapshot
  var expandedBatches = {};       // batchId -> bool (batches start expanded, as source)

  var STAR_BADGE_PATH = 'M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.6l-6.1 3.5 1.4-6.8-5.1-4.7 6.9-.8L12 2.5z';
  var VERIFIED_LABEL = 'Verified account'; // REAL — source label
  var HIDDEN_PW = '••••••••••';            // REAL — display-only placeholder glyph from source

  /* =========================================================================
   * Card templates — structural clones of the source card markup.
   * Every dynamic value is escaped or assigned via textContent.
   * ========================================================================= */

  function dotsRow() {
    var div = document.createElement('div');
    div.className = 'dots';
    for (var i = 0; i < 10; i++) {
      var s = document.createElement('span');
      div.appendChild(s);
    }
    return div;
  }

  function copyBtn(value, svg) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('data-copy', value);
    var box = document.createElement('div');
    box.className = 'btn-box';
    box.innerHTML = svg;
    var label = document.createElement('span');
    label.className = 'btn-label';
    label.textContent = 'COPY';
    btn.appendChild(box);
    btn.appendChild(label);
    return btn;
  }

  var SVG_COPY_SINGLE =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="8" width="11" height="11" rx="2.3" stroke="var(--accent)" stroke-width="1.7"/><path d="M7.5 8V6C7.5 4.6 8.6 3.5 10 3.5H18C19.4 3.5 20.5 4.6 20.5 6V14C20.5 15.4 19.4 16.5 18 16.5H17" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var SVG_COPY_KEY =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10" width="15" height="11" rx="2.8" stroke="var(--accent)" stroke-width="1.7"/><path d="M7.8 10V7.2C7.8 4.9 9.7 3 12 3C14.3 3 16.2 4.9 16.2 7.2V10" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round"/><line x1="12" y1="14" x2="12" y2="17.5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/><line x1="10.2" y1="15.7" x2="13.8" y2="15.7" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var SVG_COPY_MAIL =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="var(--accent)" stroke-width="1.7"/><path d="M3.5 6.5L12 13L20.5 6.5" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SVG_COPY_KEY_SM =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10" width="15" height="11" rx="2.8" stroke="var(--accent)" stroke-width="1.7"/><path d="M7.8 10V7.2C7.8 4.9 9.7 3 12 3C14.3 3 16.2 4.9 16.2 7.2V10" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round"/><line x1="12" y1="14" x2="12" y2="17.5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/><line x1="10.2" y1="15.7" x2="13.8" y2="15.7" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function avatarBadge() {
    var el = document.createElement('div');
    el.className = 'avatar-badge';
    el.innerHTML =
      '<div class="icon-wrap"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="var(--accent)" stroke-width="1.8"/><path d="M4.5 20.5C4.5 16.4 7.8 14 12 14C16.2 14 19.5 16.4 19.5 20.5" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
      '<div class="tag">SINGLE</div>';
    return el;
  }

  function starBadge(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'star-badge');
    svg.setAttribute('id', 'star-' + id);
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'var(--accent)');
    svg.style.cssText = 'display:none;flex-shrink:0;';
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', STAR_BADGE_PATH);
    svg.appendChild(path);
    return svg;
  }

  function menuDots(id, label) {
    var div = document.createElement('div');
    div.className = 'menu-dots';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('data-action', 'card-menu');
    div.setAttribute('data-card', id);
    div.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); div.click(); }
    });
    div.innerHTML = '<svg viewBox="0 0 24 24" aria-label="' + label + '"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
    return div;
  }

  function metaEl(vm, verified) {
    var meta = document.createElement('div');
    meta.className = 'meta';
    var parts = MF.dom.metaParts(vm.date);
    var date = document.createElement('span');
    date.className = 'date';
    date.textContent = verified ? VERIFIED_LABEL : parts.date;
    var time = document.createElement('span');
    time.className = 'time';
    time.textContent = verified ? '' : parts.time;
    meta.appendChild(date);
    meta.appendChild(time);
    return meta;
  }

  function applySingleVerifiedUi(card, vm) {
    if (vm.verified) {
      card.setAttribute('data-verified', 'true');
      if (!card.querySelector('.verified-badge')) {
        var badge = document.createElement('span');
        badge.className = 'verified-badge';
        badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7"/></svg><span>VERIFIED</span>';
        card.appendChild(badge);
      }
    } else {
      card.removeAttribute('data-verified');
      var badge = card.querySelector('.verified-badge');
      if (badge) badge.remove();
    }
    // When verified, the meta shows the label (renderer already did this).
  }

  function buildSingleCard(vm) {
    var card = document.createElement('div');
    card.className = 'card';
    card.id = vm.id;
    card.setAttribute('data-type', 'single');
    card.setAttribute('data-date', vm.date);
    card.setAttribute('data-starred', vm.starred ? 'true' : 'false');
    card.dataset.email = vm.email;

    var row = document.createElement('div');
    row.className = 'account-row';
    row.appendChild(avatarBadge());

    var info = document.createElement('div');
    info.className = 'account-info';
    var email = document.createElement('div');
    email.className = 'account-email';
    email.textContent = vm.email; // textContent — XSS-safe by construction
    info.appendChild(email);
    info.appendChild(dotsRow());
    row.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'action-group';
    actions.appendChild(copyBtn(vm.email, SVG_COPY_SINGLE));
    actions.appendChild(copyBtn(vm.password || HIDDEN_PW, SVG_COPY_KEY));
    row.appendChild(actions);

    row.appendChild(metaEl(vm, vm.verified));
    var star = starBadge(vm.id);
    star.style.display = vm.starred ? 'flex' : 'none';
    row.appendChild(star);
    row.appendChild(menuDots(vm.id, 'Account actions'));

    card.appendChild(row);
    applySingleVerifiedUi(card, vm);
    return card;
  }

  function buildBatchCard(vm) {
    var card = document.createElement('div');
    card.className = 'card';
    card.id = vm.id;
    card.setAttribute('data-type', 'batch');
    card.setAttribute('data-date', vm.date);
    card.setAttribute('data-starred', vm.starred ? 'true' : 'false');

    var header = document.createElement('div');
    header.className = 'batch-header';
    header.setAttribute('data-action', 'toggle-batch');
    header.setAttribute('data-batch', vm.id);
    header.innerHTML =
      '<div class="batch-icon">' +
        '<div class="icon-wrap"><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 3L21 8L12 13L3 8L12 3Z" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12.3L12 17.3L21 12.3" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M3 16.6L12 21.6L21 16.6" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg></div>' +
        '<div class="tag">BATCH</div>' +
      '</div>';
    var info = document.createElement('div');
    info.className = 'batch-info';
    var lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = 'Batch';
    var sep = document.createElement('span');
    sep.className = 'dot-sep';
    sep.textContent = '•';
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = vm.count + ' Accounts';
    info.appendChild(lbl); info.appendChild(sep); info.appendChild(count);
    header.appendChild(info);

    var metaWrap = document.createElement('div');
    metaWrap.className = 'batch-meta';
    metaWrap.appendChild(metaEl(vm, false));
    var chev = document.createElement('div');
    chev.className = 'chevron';
    chev.setAttribute('id', 'chev-' + vm.id);
    chev.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 9L12 16L19 9" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    metaWrap.appendChild(chev);
    var star = starBadge(vm.id);
    star.style.display = vm.starred ? 'flex' : 'none';
    metaWrap.appendChild(star);
    metaWrap.appendChild(menuDots(vm.id, 'Batch actions'));
    header.appendChild(metaWrap);

    card.appendChild(header);

    var sublist = document.createElement('div');
    sublist.className = 'sublist';
    sublist.setAttribute('id', 'sub-' + vm.id);
    var inner = document.createElement('div');
    inner.className = 'sublist-inner';
    sublist.appendChild(inner);
    card.appendChild(sublist);

    // Real members only — the source's synthetic row generator is gone.
    vm.members.forEach(function (m, i) {
      inner.appendChild(buildSubitem(vm.id, i, m));
    });
    if (vm.count > 3) {
      inner.appendChild(buildViewAll(vm.id, vm.count));
    }
    return card;
  }

  function pad3(n) { return String(n).padStart(3, '0'); } // REAL — source `pad`

  function buildSubitem(batchId, index, member) {
    var row = document.createElement('div');
    row.className = 'subitem';
    row.setAttribute('data-index', String(index));
    row.dataset.email = member.email;

    var idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = '#' + pad3(index + 1);
    row.appendChild(idx);

    var info = document.createElement('div');
    info.className = 'sub-info';
    var email = document.createElement('div');
    email.className = 'sub-email';
    email.textContent = member.email;
    info.appendChild(email);
    info.appendChild(dotsRow());
    row.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'action-group';
    actions.appendChild(copyBtn(member.email, SVG_COPY_MAIL));
    actions.appendChild(copyBtn(member.password || HIDDEN_PW, SVG_COPY_KEY_SM));
    row.appendChild(actions);
    return row;
  }

  function buildViewAll(batchId, count) {
    var el = document.createElement('div');
    el.className = 'view-all';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-action', 'view-all');
    el.setAttribute('data-batch', batchId);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
    var txt = document.createElement('div');
    txt.className = 'txt';
    var strong = document.createElement('strong');
    strong.textContent = '+' + (count - 3) + ' more accounts';
    var span = document.createElement('span');
    span.textContent = 'Tap to view all';
    txt.appendChild(strong); txt.appendChild(span);
    var chev = document.createElement('span');
    chev.className = 'chev';
    chev.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="var(--accent)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    el.appendChild(txt);
    el.appendChild(chev);
    return el;
  }

  /* =========================================================================
   * Rendering
   * ========================================================================= */

  function cardById(id) {
    var el = document.getElementById(id);
    return el && el.classList.contains('card') ? el : null;
  }

  function applyExpansion(card, id) {
    var sub = card.querySelector('.sublist');
    var chev = card.querySelector('.chevron');
    if (!sub) return;
    var expanded = expandedBatches[id] !== false; // default expanded (source)
    sub.style.gridTemplateRows = expanded ? '1fr' : '0fr';
    if (chev) chev.classList.toggle('collapsed', !expanded);
  }

  function collapseViewAll(card, vm) {
    var inner = card.querySelector('.sublist-inner');
    if (!inner) return;
    var items = inner.querySelectorAll('.subitem');
    items.forEach(function (item, i) { if (i >= 3) item.remove(); });
    var box = inner.querySelector('.view-all');
    if (box) {
      box.dataset.expanded = 'false';
      var strong = box.querySelector('.txt strong');
      var span = box.querySelector('.txt span');
      var chev = box.querySelector('.chev');
      if (strong) strong.textContent = '+' + (vm.count - 3) + ' more accounts';
      if (span) span.textContent = 'Tap to view all';
      if (chev) chev.style.transform = '';
    }
  }

  function renderList() {
    var vms = MF.LibraryRepository.viewModels();
    vms.sort(MF.LibraryRepository.comparator(currentSort));

    var results = searchQuery ? (MF.LibraryRepository.query(searchQuery) || []) : null;
    var matchMap = {};
    if (results) results.forEach(function (r) { matchMap[r.id] = r.matches; });

    list.innerHTML = '';
    vms.forEach(function (vm) {
      var card = vm.kind === 'single' ? buildSingleCard(vm) : buildBatchCard(vm);
      if (vm.kind === 'batch') applyExpansion(card, vm.id);

      if (searchQuery) {
        // Active search: re-apply card visibility + sub-item filtering on
        // every render so store mutations don't reset the filtered view.
        var matches = matchMap[vm.id] || 0;
        card.style.display = matches > 0 ? '' : 'none';
        if (vm.kind === 'batch' && matches > 0) {
          expandedBatches[vm.id] = true; // auto-expand matching batches (source)
          applyExpansion(card, vm.id);
          filterSubitems(card, searchQuery);
        }
      }
      list.appendChild(card);
    });

    updateTotal();
    updateSearchMeta();
  }

  function updateTotal() {
    var el = document.querySelector('#screen-library .stat-number');
    if (el) el.textContent = String(MF.LibraryRepository.total());
  }

  /* =========================================================================
   * Sorting (six modes preserved)
   * ========================================================================= */

  function selectSort(mode) {
    currentSort = mode;
    MF.dom.qa('#screen-library .filter-option').forEach(function (opt) {
      opt.classList.toggle('selected', opt.dataset.mode === mode);
    });
    renderList();
    closeAllSheets();
  }

  /* =========================================================================
   * Sheets (filter / search / card menu) — source behaviour
   * ========================================================================= */

  function showSheet(id) {
    document.getElementById('backdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
  }
  function closeAllSheets() {
    document.getElementById('backdrop').classList.remove('show');
    MF.dom.qa('#screen-library .sheet').forEach(function (s) { s.classList.remove('show'); });
  }
  function openFilterSheet() {
    MF.dom.qa('#screen-library .filter-option').forEach(function (opt) {
      opt.classList.toggle('selected', opt.dataset.mode === currentSort);
    });
    showSheet('filterSheet');
  }

  /* =========================================================================
   * Search — live, view-state only, over REAL records (matrix §13/§15)
   * ========================================================================= */

  function filterSubitems(card, q) {
    var vmMatch = null;
    var results = MF.LibraryRepository.query(q);
    if (results) {
      results.forEach(function (r) { if (r.id === card.id) vmMatch = r; });
    }
    card.querySelectorAll('.subitem').forEach(function (si) {
      var em = (si.dataset.email || '').toLowerCase();
      var hit = !q || em.indexOf(q.toLowerCase()) !== -1;
      si.style.display = (vmMatch && q) ? (hit ? '' : 'none') : '';
    });
  }

  function updateSearchMeta() {
    var meta = document.getElementById('libSearchMeta');
    if (!meta) return;
    if (!searchQuery) {
      meta.textContent = '';
      meta.classList.remove('none');
      return;
    }
    var results = MF.LibraryRepository.query(searchQuery) || [];
    var matches = results.reduce(function (sum, r) { return sum + r.matches; }, 0);
    meta.textContent = matches === 0 ? 'No matches' : (matches === 1 ? '1 match' : matches + ' matches');
    meta.classList.toggle('none', matches === 0);
  }

  function applyLibrarySearch(qRaw) {
    var q = String(qRaw || '').trim().toLowerCase();
    searchQuery = q;

    var results = MF.LibraryRepository.query(q);
    var matchMap = {};
    if (results) results.forEach(function (r) { matchMap[r.id] = r.matches; });

    MF.dom.qa('#screen-library #list .card').forEach(function (card) {
      var matches = q ? (matchMap[card.id] || 0) : 1;
      if (card.dataset.type === 'batch') {
        if (!q) {
          card.querySelectorAll('.subitem').forEach(function (si) { si.style.display = ''; });
        } else if (matches > 0) {
          // auto-expand matching batches (source behaviour)
          expandedBatches[card.id] = true;
          applyExpansion(card, card.id);
          filterSubitems(card, q);
        } else {
          card.querySelectorAll('.subitem').forEach(function (si) { si.style.display = ''; });
        }
      }
      card.style.display = matches > 0 ? '' : 'none';
    });

    updateSearchMeta();
    document.getElementById('libSearchBtn').classList.toggle('active', !!q);
    renderListSortOnly();
  }

  // Re-apply the current sort ordering without wiping search display state.
  function renderListSortOnly() {
    var cards = Array.prototype.slice.call(list.children).filter(function (el) {
      return el.classList.contains('card');
    });
    var vms = {};
    MF.LibraryRepository.viewModels().forEach(function (vm) { vms[vm.id] = vm; });
    cards.sort(function (a, b) {
      var va = vms[a.id], vb = vms[b.id];
      if (!va || !vb) return 0;
      return MF.LibraryRepository.comparator(currentSort)(va, vb);
    });
    cards.forEach(function (c) { list.appendChild(c); });
  }

  function openSearchSheet() {
    showSheet('searchSheet');
    // Snapshot how each batch is expanded right now, so clearing the
    // search restores the exact normal state (source behaviour).
    presearchExpansion = {};
    MF.dom.qa('#screen-library #list .card[data-type="batch"]').forEach(function (card) {
      var sub = card.querySelector('.sublist');
      presearchExpansion[card.id] = (sub && sub.style.gridTemplateRows === '1fr') ? '1' : '0';
    });
    var input = document.getElementById('libSearchInput');
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 120);
  }

  function clearLibrarySearch() {
    var input = document.getElementById('libSearchInput');
    if (input) input.value = '';
    // Restore each batch to its pre-search expansion state.
    MF.dom.qa('#screen-library #list .card[data-type="batch"]').forEach(function (card) {
      var wasExpanded = presearchExpansion[card.id] === '1';
      expandedBatches[card.id] = wasExpanded;
      applyExpansion(card, card.id);
    });
    presearchExpansion = {};
    applyLibrarySearch('');
  }

  function closeSheetsWithSearchReset() {
    var sheet = document.getElementById('searchSheet');
    if (sheet && sheet.classList.contains('show') && searchQuery) {
      clearLibrarySearch();
    }
    closeAllSheets();
  }

  /* =========================================================================
   * Card menu (star / verify / rename / delete) — source semantics
   * ========================================================================= */

  var STAR_OUTLINE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="' + STAR_BADGE_PATH + '" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var STAR_FILLED = '<svg width="17" height="17" viewBox="0 0 24 24" fill="var(--accent)"><path d="' + STAR_BADGE_PATH + '"/></svg>';

  function cardTitle(vm) {
    if (vm.kind === 'single') return vm.email;
    return 'Batch • ' + vm.count + ' Accounts';
  }

  function currentVm() {
    var vms = MF.LibraryRepository.viewModels();
    for (var i = 0; i < vms.length; i++) {
      if (vms[i].id === currentCardId) return vms[i];
    }
    return null;
  }

  function openCardMenu(recordId) {
    currentCardId = recordId;
    currentSubitem = null;
    var vm = currentVm();
    if (!vm) return;
    document.getElementById('cardMenuTitle').textContent = cardTitle(vm);
    document.getElementById('cardMenuStarIcon').innerHTML = vm.starred ? STAR_FILLED : STAR_OUTLINE;
    document.getElementById('cardMenuStarLabel').textContent = vm.starred ? 'Remove from Starred' : 'Add to Starred';
    document.getElementById('cardMenuStarOption').style.display = 'flex';
    document.getElementById('cardMenuRenameOption').style.display = 'flex';
    document.getElementById('cardMenuDeleteOption').style.display = 'flex';
    document.getElementById('cardMenuVerifyOption').style.display = vm.kind === 'single' ? 'flex' : 'none';
    document.getElementById('cardMenuVerifyLabel').textContent = vm.verified ? 'Unverify' : 'Verify';
    showSheet('cardMenuSheet');
  }

  function openBatchAccountMenu(batchId, index, emailText) {
    currentCardId = null;
    currentSubitem = { batchId: batchId, index: index };
    document.getElementById('cardMenuTitle').textContent = emailText;
    document.getElementById('cardMenuStarOption').style.display = 'none';
    document.getElementById('cardMenuRenameOption').style.display = 'none';
    document.getElementById('cardMenuDeleteOption').style.display = 'none';
    document.getElementById('cardMenuVerifyOption').style.display = 'flex';
    document.getElementById('cardMenuVerifyLabel').textContent = 'Verify';
    showSheet('cardMenuSheet');
  }

  function toggleStarCurrent() {
    if (!currentCardId) return;
    MF.LibraryRepository.toggleStarred(currentCardId);
    closeAllSheets();
  }

  function toggleVerificationCurrent() {
    if (currentSubitem) {
      // Batch sub-account → separate into its own verified single (real mutation).
      MF.LibraryRepository.separateMember(currentSubitem.batchId, currentSubitem.index);
      currentSubitem = null;
      closeAllSheets();
      return;
    }
    if (!currentCardId) return;
    MF.LibraryRepository.toggleVerified(currentCardId);
    closeAllSheets();
  }

  function renameCurrent() {
    if (!currentCardId) return;
    var vm = currentVm();
    if (!vm) return;
    if (vm.kind === 'single') {
      var val = prompt('Rename account', vm.email);
      if (val && val.trim()) MF.LibraryRepository.rename(vm.id, val.trim());
    } else {
      var val2 = prompt('Rename batch', vm.name);
      if (val2 && val2.trim()) MF.LibraryRepository.rename(vm.id, val2.trim());
    }
    closeAllSheets();
  }

  function deleteCurrent() {
    if (!currentCardId) return;
    var vm = currentVm();
    if (!vm) return;
    var ok = confirm('Delete "' + cardTitle(vm) + '"? This can\'t be undone.');
    if (ok) {
      var card = cardById(vm.id);
      var finish = function () { MF.LibraryRepository.remove(vm.id); };
      if (card) {
        card.style.transition = 'opacity .2s, transform .2s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96)';
        setTimeout(finish, 200); // matches the source's exit animation timing
      } else {
        finish();
      }
    }
    closeAllSheets();
  }

  /* =========================================================================
   * Copy handling — delegated, covers rendered + newly expanded rows
   * ========================================================================= */

  function initDelegatedCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#screen-library .copy-btn');
      if (!btn) return;
      e.stopPropagation();
      var label = btn.querySelector('.btn-label');
      btn._libraryCopyLabel = btn._libraryCopyLabel || label.textContent;
      var request = btn._libraryCopyRequest = (btn._libraryCopyRequest || 0) + 1;
      clearTimeout(btn._libraryCopyTimer);
      MF.clipboard.copyText(btn.getAttribute('data-copy') || '').then(function (success) {
        if (request !== btn._libraryCopyRequest) return;
        label.textContent = success ? 'DONE' : 'RETRY';
        if (!success) {
          var value = btn.closest('.account-row,.subitem');
          if (value) {
            var target = value.querySelector('.account-email,.sub-email');
            if (target) MF.clipboard.selectElementText(target);
          }
        }
        btn._libraryCopyTimer = setTimeout(function () {
          label.textContent = btn._libraryCopyLabel;
        }, 900);
      });
    });
  }

  /* =========================================================================
   * Long-press batch sub-account menu (~550ms intent, source parity)
   * ========================================================================= */

  var batchPressTimer = null;
  function initLongPress() {
    document.addEventListener('pointerdown', function (event) {
      var row = event.target.closest('#screen-library .subitem');
      if (!row || event.target.closest('.copy-btn')) return;
      var card = row.closest('.card[data-type="batch"]');
      if (!card) return;
      var index = parseInt(row.dataset.index, 10);
      var emailText = row.querySelector('.sub-email');
      batchPressTimer = setTimeout(function () {
        openBatchAccountMenu(card.id, index, emailText ? emailText.textContent.trim() : 'Account');
      }, 550);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      document.addEventListener(type, function () { clearTimeout(batchPressTimer); });
    });
  }

  /* =========================================================================
   * Event wiring
   * ========================================================================= */

  function onListClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el || !list.contains(el)) return;
    var action = el.dataset.action;
    if (action === 'toggle-batch') {
      var id = el.dataset.batch;
      expandedBatches[id] = expandedBatches[id] === false ? true : false;
      var card = cardById(id);
      if (card) applyExpansion(card, id);
    } else if (action === 'view-all') {
      var batchId = el.dataset.batch;
      var vm = null;
      MF.LibraryRepository.viewModels().forEach(function (v) { if (v.id === batchId) vm = v; });
      var batchCard = cardById(batchId);
      if (!batchCard || !vm) return;
      var box = batchCard.querySelector('.view-all');
      var expanded = box && box.dataset.expanded === 'true';
      var inner = batchCard.querySelector('.sublist-inner');
      if (!expanded) {
        // Render the REAL remaining members (no synthesis — removed from source).
        inner.querySelectorAll('.view-all').forEach(function (v) { v.remove(); });
        vm.members.slice(3).forEach(function (m, i) {
          inner.appendChild(buildSubitem(batchId, i + 3, m));
        });
        if (box) {
          box.dataset.expanded = 'true';
          var strong = box.querySelector('.txt strong');
          var span = box.querySelector('.txt span');
          var chev = box.querySelector('.chev');
          if (strong) strong.textContent = 'Show less';
          if (span) span.textContent = vm.count + ' of ' + vm.count + ' accounts loaded';
          if (chev) chev.style.transform = 'rotate(90deg)';
          inner.appendChild(box);
        }
      } else {
        collapseViewAll(batchCard, vm);
      }
      if (searchQuery) filterSubitems(batchCard, searchQuery);
    } else if (action === 'card-menu') {
      e.stopPropagation();
      openCardMenu(el.dataset.card);
    }
  }

  function init() {
    list = document.getElementById('list');

    // Static sheet controls keep the source's runtime a11y semantics
    // (role button / tabindex / Enter + Space), since these divs are not
    // buttons for visual reasons.
    MF.dom.qa('#screen-library .sheet-option, #screen-library .filter-option').forEach(function (el) {
      if (el.dataset.a11yBound === '1') return;
      el.dataset.a11yBound = '1';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    // Sort sheet options
    MF.dom.qa('#screen-library .filter-option').forEach(function (opt) {
      opt.addEventListener('click', function () { selectSort(opt.dataset.mode); });
    });

    // Header actions
    document.getElementById('libSearchBtn').addEventListener('click', openSearchSheet);
    MF.dom.qa('[data-action="open-filter-sheet"]').forEach(function (el) {
      el.addEventListener('click', openFilterSheet);
    });

    // Sheets
    document.getElementById('backdrop').addEventListener('click', closeSheetsWithSearchReset);
    var input = document.getElementById('libSearchInput');
    input.addEventListener('input', function () { applyLibrarySearch(input.value); });
    document.getElementById('libSearchClear').addEventListener('click', function () {
      clearLibrarySearch();
      try { input.focus(); } catch (_) {}
    });
    document.addEventListener('keydown', function (e) {
      var sheet = document.getElementById('searchSheet');
      if (e.key === 'Escape' && sheet && sheet.classList.contains('show')) {
        clearLibrarySearch();
        closeAllSheets();
      }
    });

    // Card menu options
    document.getElementById('cardMenuStarOption').addEventListener('click', toggleStarCurrent);
    document.getElementById('cardMenuVerifyOption').addEventListener('click', toggleVerificationCurrent);
    document.getElementById('cardMenuRenameOption').addEventListener('click', renameCurrent);
    document.getElementById('cardMenuDeleteOption').addEventListener('click', deleteCurrent);

    // List interactions (event delegation survives re-renders)
    list.addEventListener('click', onListClick);

    initDelegatedCopy();
    initLongPress();

    // Repository changes re-render the list from the authoritative store —
    // always, so returning to the Library is never stale (DOM is not the
    // database; the store is).
    MF.LibraryRepository.subscribe(function () { renderList(); });

    renderList();
  }

  MF.libraryPage = { init: init, renderList: renderList };
})(window);
