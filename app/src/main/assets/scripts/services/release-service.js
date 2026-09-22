/* =========================================================================
 * MF.ReleaseService — REAL GitHub Releases integration (kept real, matrix §31)
 * -------------------------------------------------------------------------
 * The source used the live GitHub API for update checks and version
 * history. That stays exactly as real; only the repository value moved to
 * config. compareVersions() is preserved verbatim (and unit-tested).
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  /** Numeric semver-ish comparison: -1 (a<b), 0 (equal), 1 (a>b). REAL — from source. */
  function compareVersions(a, b) {
    var pa = String(a).split(/[.-]/).map(function (x) { return parseInt(x, 10); })
      .filter(function (n) { return !Number.isNaN(n); });
    var pb = String(b).split(/[.-]/).map(function (x) { return parseInt(x, 10); })
      .filter(function (n) { return !Number.isNaN(n); });
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function api(path) {
    return MF.config.github.apiReleasesBase + MF.config.github.repo + path;
  }
  function releasesUrl() {
    return MF.config.github.htmlBase + MF.config.github.repo + '/releases';
  }

  /**
   * Promise< {status:'up-to-date'|'update-available'|'ahead'|'no-releases',
   *           latest?, releaseUrl?} > — rejects on network/HTTP failure.
   */
  function checkForUpdate() {
    var current = MF.config.version.current;
    return fetch(api('/releases/latest'), { cache: 'no-store' }).then(function (res) {
      if (res.status === 404) return { status: 'no-releases' };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().then(function (data) {
        var latest = String(data && data.tag_name ? data.tag_name : '')
          .replace(/^v/i, '').trim();
        if (!latest || !/^\d/.test(latest)) {
          throw new Error('Invalid release response');
        }
        var cmp = compareVersions(latest, current);
        if (cmp > 0) {
          return {
            status: 'update-available', latest: latest,
            releaseUrl: String(data.html_url || releasesUrl())
          };
        }
        if (cmp === 0) return { status: 'up-to-date', latest: latest };
        return { status: 'ahead', latest: latest };
      });
    });
  }

  /** Promise<Array<release>> — normalized release history entries. */
  function fetchHistory() {
    return fetch(api('/releases'), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().then(function (releases) {
        if (!Array.isArray(releases)) throw new Error('Invalid release response');
        return releases.slice(0, 10).map(function (r, i) {
          var published = r.published_at && !Number.isNaN(new Date(r.published_at).getTime())
            ? new Date(r.published_at) : null;
          return {
            version: String(r.tag_name || r.name || 'Release'),
            tag: i === 0 ? 'Latest' : (r.prerelease ? 'Pre-release' : 'Stable'),
            dateText: published
              ? published.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
              : '',
            notes: String(r.body || 'No release notes provided.').split('\n')[0].slice(0, 140),
            url: String(r.html_url || releasesUrl())
          };
        });
      });
    });
  }

  MF.ReleaseService = {
    compareVersions: compareVersions,
    checkForUpdate: checkForUpdate,
    fetchHistory: fetchHistory
  };
})(window);
