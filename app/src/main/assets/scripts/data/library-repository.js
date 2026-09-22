/* =========================================================================
 * MF.LibraryRepository — the single authoritative Library data store
 * -------------------------------------------------------------------------
 * The source treated the DOM as the database: hardcoded demo cards plus six
 * localStorage side-keys (verified/starred/separated/renames/batchCounts…)
 * that had to be reconciled against fabricated markup on every load.
 *
 * This repository replaces that with a real, versioned, persisted store:
 *
 *   Real Data Source (engine results / future imports)
 *     → LibraryRepository (this file: records + state + persistence)
 *       → Library State selectors
 *         → Library UI (scripts/pages/library.js renders from here only)
 *
 * PRESERVED STATE SEMANTICS (matrix §12–§15):
 *   - verified  : set of single-record ids (green card + VERIFIED badge)
 *   - starred   : set of record ids — singles AND batches (independent of
 *                 verification, exactly like the source's separate stores)
 *   - renames   : per-record {from,to} so renamed emails survive reload
 *   - batchCounts: REMOVED as persisted state — the source stored counts in
 *                 the `mailFactoryBatchCounts` key (plus the legacy
 *                 `mailFactoryLibraryBatchCounts`-shaped access in some
 *                 builds); counts are now DERIVED from real members
 *                 (batch.members.length), so a count can never diverge
 *                 from actual data again.
 *   - separatedAccounts: REMOVED as a separate array — separating a batch
 *                 member is a real mutation (member moves into a new single
 *                 record with originBatchId), not a DOM trick.
 *
 * INITIAL DATA: intentionally EMPTY. The source's five fabricated cards
 * (darkknight07/shadowhunter99/cyberbeast, 250×alpha, 120×beta) were demo
 * data and are gone. The store fills only from real results.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var storage = MF.storage;
  var CONFIG_KEY = function () { return MF.config.storage.library; };

  var listeners = [];
  var db = null;
  var idCounter = 0;

  function emptyDb() {
    return { v: 1, records: [], state: { verified: {}, starred: {}, renames: {} } };
  }

  function newId() {
    idCounter += 1;
    return 'r' + Date.now().toString(36) + '-' + idCounter.toString(36) +
      Math.floor(Math.random() * 1e4).toString(36);
  }

  /** Defensive normalisation of one persisted record (drops malformed data). */
  function normalizeRecord(raw) {
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    if (raw.kind === 'single') {
      if (typeof raw.email !== 'string' || !raw.email) return null;
      return {
        id: String(raw.id), kind: 'single', email: raw.email,
        password: typeof raw.password === 'string' ? raw.password : null,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        originBatchId: typeof raw.originBatchId === 'string' ? raw.originBatchId : null
      };
    }
    if (raw.kind === 'batch') {
      var members = Array.isArray(raw.members) ? raw.members.filter(function (m) {
        return m && typeof m.email === 'string' && m.email;
      }).map(function (m) {
        return {
          email: m.email,
          password: typeof m.password === 'string' ? m.password : null,
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString()
        };
      }) : [];
      return {
        id: String(raw.id), kind: 'batch',
        name: typeof raw.name === 'string' && raw.name ? raw.name : 'Batch',
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        members: members
      };
    }
    return null;
  }

  function load() {
    var parsed = storage.getJson(CONFIG_KEY(), null);
    db = emptyDb();
    if (parsed && typeof parsed === 'object') {
      var records = Array.isArray(parsed.records) ? parsed.records : [];
      records.forEach(function (raw) {
        var rec = normalizeRecord(raw);
        if (rec) db.records.push(rec);
      });
      var st = parsed.state && typeof parsed.state === 'object' ? parsed.state : {};
      ['verified', 'starred', 'renames'].forEach(function (k) {
        if (st[k] && typeof st[k] === 'object' && !Array.isArray(st[k])) db.state[k] = st[k];
      });
    }
  }

  function persist() { storage.setJson(CONFIG_KEY(), db); }

  function emit() {
    persist();
    listeners.forEach(function (fn) {
      try { fn(db); } catch (e) { /* one bad listener must not break the rest */ }
    });
  }

  function find(id) {
    for (var i = 0; i < db.records.length; i++) {
      if (db.records[i].id === id) return db.records[i];
    }
    return null;
  }

  var repo = {

    /** Subscribe to change events; returns an unsubscribe function. */
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },

    getAll: function () { return db.records; },
    get: find,

    /** Display email of a single record, honoring persisted renames. */
    displayEmail: function (record) {
      if (!record || record.kind !== 'single') return '';
      var r = db.state.renames[record.id];
      return r && typeof r.to === 'string' ? r.to : record.email;
    },

    /** Display label of a batch, honoring persisted renames. */
    displayName: function (record) {
      if (!record || record.kind !== 'batch') return '';
      var r = db.state.renames[record.id];
      return r && typeof r.to === 'string' ? r.to : record.name;
    },

    /* ---------- state selectors ---------- */
    isVerified: function (id) {
      return !!db.state.verified[id];
    },
    isStarred: function (id) {
      return !!db.state.starred[id];
    },

    /* ---------- mutations ---------- */
    toggleVerified: function (id) {
      var rec = find(id);
      if (!rec || rec.kind !== 'single') return false;
      if (db.state.verified[id]) delete db.state.verified[id];
      else db.state.verified[id] = true;
      emit();
      return true;
    },

    toggleStarred: function (id) {
      var rec = find(id);
      if (!rec) return false;
      if (db.state.starred[id]) delete db.state.starred[id];
      else db.state.starred[id] = true;
      emit();
      return true;
    },

    /** Rename a single (new display email) or a batch (new display name). */
    rename: function (id, newName) {
      var rec = find(id);
      if (!rec) return false;
      var name = String(newName || '').trim();
      if (!name) return false;
      var from = rec.kind === 'single' ? repo.displayEmail(rec) : repo.displayName(rec);
      if (name === from) return false;
      db.state.renames[id] = { from: from, to: name };
      emit();
      return true;
    },

    /** Remove a record and every persisted trace of it. */
    remove: function (id) {
      var idx = -1;
      for (var i = 0; i < db.records.length; i++) {
        if (db.records[i].id === id) { idx = i; break; }
      }
      if (idx === -1) return false;
      db.records.splice(idx, 1);
      delete db.state.verified[id];
      delete db.state.starred[id];
      delete db.state.renames[id];
      emit();
      return true;
    },

    /**
     * Separate a batch member into its own verified single record — the
     * source's "Verify" action on a batch sub-account, now as a real
     * mutation. Member index refers to batch.members.
     */
    separateMember: function (batchId, memberIndex) {
      var batch = find(batchId);
      if (!batch || batch.kind !== 'batch') return null;
      var i = Number(memberIndex);
      if (!Number.isInteger(i) || i < 0 || i >= batch.members.length) return null;
      var member = batch.members.splice(i, 1)[0];
      var single = {
        id: newId(), kind: 'single',
        email: member.email, password: member.password,
        createdAt: new Date().toISOString(), originBatchId: batch.id
      };
      db.records.push(single);
      db.state.verified[single.id] = true;
      emit();
      return single;
    },

    /** Add a single account (engine result or future real source). */
    addSingle: function (account) {
      if (!account || typeof account.email !== 'string' || !account.email) return null;
      var rec = normalizeRecord({
        id: newId(), kind: 'single',
        email: account.email,
        password: account.password,
        createdAt: account.createdAt || new Date().toISOString()
      });
      if (!rec) return null;
      db.records.push(rec);
      emit();
      return rec;
    },

    /** Add a batch of real records (engine result or future real source). */
    addBatch: function (name, members) {
      var clean = (Array.isArray(members) ? members : []).filter(function (m) {
        return m && typeof m.email === 'string' && m.email;
      });
      var rec = normalizeRecord({
        id: newId(), kind: 'batch',
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Batch',
        members: clean,
        createdAt: new Date().toISOString()
      });
      if (!rec) return null;
      db.records.push(rec);
      emit();
      return rec;
    },

    /* ---------- derived selectors ---------- */

    /** TOTAL accounts: singles + all batch members (from real data only). */
    total: function () {
      var total = 0;
      db.records.forEach(function (r) {
        total += r.kind === 'single' ? 1 : r.members.length;
      });
      return total;
    },

    /**
     * Search across real records only. Replaces the source's
     * batchExpectedEmails() synthesis: match counts come from actual
     * stored members — including members not currently rendered.
     * Returns [{ id, matches }] for records with matches > 0.
     */
    query: function (rawQuery) {
      var q = String(rawQuery || '').trim().toLowerCase();
      if (!q) return null;
      var out = [];
      db.records.forEach(function (r) {
        var matches = 0;
        if (r.kind === 'single') {
          if (repo.displayEmail(r).toLowerCase().indexOf(q) !== -1) matches = 1;
        } else {
          if (repo.displayName(r).toLowerCase().indexOf(q) !== -1) {
            matches = r.members.length;
          } else {
            r.members.forEach(function (m) {
              if (m.email.toLowerCase().indexOf(q) !== -1) matches += 1;
            });
          }
        }
        if (matches > 0) out.push({ id: r.id, matches: matches });
      });
      return out;
    },

    /** Sort comparator per UI sort mode (operates on view models). */
    comparator: function (mode) {
      return function (a, b) {
        switch (mode) {
          case 'oldest': return a.date.localeCompare(b.date);
          case 'singles':
            return (a.kind === 'single' ? 0 : 1) - (b.kind === 'single' ? 0 : 1) ||
              b.date.localeCompare(a.date);
          case 'batches':
            return (a.kind === 'batch' ? 0 : 1) - (b.kind === 'batch' ? 0 : 1) ||
              b.date.localeCompare(a.date);
          case 'starred':
            return (a.starred ? 0 : 1) - (b.starred ? 0 : 1) || b.date.localeCompare(a.date);
          case 'verified':
            return (a.verified ? 0 : 1) - (b.verified ? 0 : 1) || b.date.localeCompare(a.date);
          case 'newest':
          default: return b.date.localeCompare(a.date);
        }
      };
    },

    /**
     * Immutable view models consumed by the UI (kind, display values and
     * live state included) — the UI never reads raw storage.
     */
    viewModels: function () {
      return db.records.map(function (r) {
        if (r.kind === 'single') {
          return {
            id: r.id, kind: 'single',
            email: repo.displayEmail(r),
            password: r.password,
            date: r.createdAt,
            verified: !!db.state.verified[r.id],
            starred: !!db.state.starred[r.id],
            members: null
          };
        }
        return {
          id: r.id, kind: 'batch',
          name: repo.displayName(r),
          count: r.members.length,
          date: r.createdAt,
          verified: false,
          starred: !!db.state.starred[r.id],
          members: r.members
        };
      });
    }
  };

  load();
  MF.LibraryRepository = repo;
})(window);
