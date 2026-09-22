/* =========================================================================
 * MF.dom — shared DOM + formatting utilities
 * -------------------------------------------------------------------------
 * The single, deduplicated implementation of the HTML-escaping helper that
 * existed three times in the source (settings, generator, library). All
 * modules escape user-derived values through here.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var ESCAPE_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };

  var dom = {
    /** Escape a value for safe interpolation into innerHTML templates. */
    escapeHtml: function (value) {
      return String(value).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
    },

    /** document.getElementById shorthand. */
    byId: function (id) { return document.getElementById(id); },

    /** Query shorthand (single). */
    q: function (selector, root) { return (root || document).querySelector(selector); },

    /** Query shorthand (all, returns a real Array). */
    qa: function (selector, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    },

    /**
     * Create an element from a trusted HTML string. The string must only
     * ever contain markup built by this app with escapeHtml() applied to
     * every user-derived value.
     */
    fromHtml: function (html) {
      var tpl = document.createElement('template');
      tpl.innerHTML = html;
      return tpl.content.firstElementChild;
    },

    /**
     * Format a timestamp exactly like the Library meta ("18 Aug 2026" /
     * "09:42 PM") — same shapes the source cards used.
     */
    metaParts: function (value) {
      var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var d = new Date(value || Date.now());
      if (Number.isNaN(d.getTime())) return { date: '', time: '' };
      var p = function (n) { return String(n).padStart(2, '0'); };
      var h24 = d.getHours();
      return {
        date: p(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(),
        time: p(h24 % 12 || 12) + ':' + p(d.getMinutes()) + ' ' + (h24 < 12 ? 'AM' : 'PM')
      };
    },

    /** Clock helpers used by the Engine Check Route page (from source). */
    clock: {
      time: function (now) {
        var p = function (n) { return String(n).padStart(2, '0'); };
        return p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
      },
      date: function (now) {
        var days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return days[now.getDay()] + ' · ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
      }
    }
  };

  MF.dom = dom;
})(window);
