/* =========================================================================
 * Mail Factory — One Touch screen (embedded VPN-UI payload host)
 * -------------------------------------------------------------------------
 * SECURITY BOUNDARY — ISOLATED, not rewritten (matrix §25/§26).
 *
 * The payload itself (#vpn-document, base64 text of a complete standalone
 * HTML document) is preserved BYTE-FOR-BYTE from the source and is inlined
 * into index.html by tools/build.py. Nothing inside it is transformed.
 *
 * Mount algorithm ported 1:1 from the source mount code:
 *   1. lazy mount on first entry; guard if already mounted,
 *   2. base64 → UTF-8 via TextDecoder,
 *   3. DOMParser; script text captured, then scripts removed,
 *   4. style rewrite :root→:host, body→.vpn-body, html→.vpn-html
 *      (same regexes incl. lookbehind, so words containing body/html
 *      are untouched),
 *   5. shadow root: <style> payload-css + native-vpn-controls </style>
 *      + .vpn-html > .vpn-body[data-state=disconnected] wrapper,
 *   6. Proxy document facade: body/documentElement remapped, hidden
 *      reflects screen visibility, visibilitychange forwarded to the real
 *      document, query APIs scoped to the shadow root,
 *   7. MutationObserver(body.class) → syncOverlay: `.one-touch-modal` on
 *      the screen view + scroll lock only when a modal is locked AND the
 *      screen is active,
 *   8. new Function('document', script)(facade) executes the payload's
 *      runtime inside the boundary.
 * `oneTouchLifecycle()` (global, as in source) re-syncs the overlay and
 * replays visibility handlers when the router enters/leaves the screen.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  function mountOneTouch() {
    var host = document.getElementById('oneTouchVPN');
    if (!host || host.shadowRoot) return;

    var payloadEl = document.getElementById('vpn-document');
    if (!payloadEl) {
      // Honest failure: the isolated payload asset is missing. Never fake a
      // connected state — report and stop.
      console.error('[OneTouch] #vpn-document payload not found — One Touch is unavailable.');
      return;
    }

    var source = new TextDecoder().decode(
      Uint8Array.from(atob(payloadEl.textContent.trim()), function (c) { return c.charCodeAt(0); })
    );
    var parsed = new DOMParser().parseFromString(source, 'text/html');
    var script = parsed.querySelector('script').textContent;
    var style = parsed.querySelector('style').textContent
      .replace(/:root/g, ':host')
      .replace(/(?<![\w-])body\b/g, '.vpn-body')
      .replace(/(?<![\w-])html\b/g, '.vpn-html');
    parsed.querySelectorAll('script').forEach(function (el) { el.remove(); });

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' + style +
      document.getElementById('native-vpn-controls').textContent +
      '</style><div class="vpn-html"><div class="vpn-body" data-state="disconnected">' +
      parsed.body.innerHTML + '</div></div>';

    var body = root.querySelector('.vpn-body');
    var html = root.querySelector('.vpn-html');
    var realDocument = document;
    var visibilityHandlers = [];

    var facade = new Proxy(realDocument, {
      get: function (target, key) {
        if (key === 'body') return body;
        if (key === 'documentElement') return html;
        if (key === 'hidden') return realDocument.hidden || !host.closest('.screen-view').classList.contains('active');
        if (key === 'getElementById') return function (id) { return root.getElementById(id); };
        if (key === 'querySelector') return function (selector) { return root.querySelector(selector); };
        if (key === 'querySelectorAll') return function (selector) { return root.querySelectorAll(selector); };
        if (key === 'addEventListener') return function (name, fn, opts) {
          if (name === 'visibilitychange') { visibilityHandlers.push(fn); realDocument.addEventListener(name, fn, opts); }
          else root.addEventListener(name, fn, opts);
        };
        var value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });

    function syncOverlay() {
      var active = host.closest('.screen-view').classList.contains('active');
      var locked = body.classList.contains('locked') && active;
      host.closest('.screen-view').classList.toggle('one-touch-modal', locked);
      document.body.style.overflow = locked ? 'hidden' : '';
    }

    global.oneTouchLifecycle = function () {
      syncOverlay();
      visibilityHandlers.forEach(function (fn) { fn(); });
    };

    new MutationObserver(syncOverlay).observe(body, { attributes: true, attributeFilter: ['class'] });

    try {
      new Function('document', script)(facade);
    } catch (err) {
      console.error('[OneTouch] payload runtime failed to initialize:', err);
    }
    // Accordion-like dialogs retain their original handlers and now use the app viewport.
  }

  MF.oneTouch = { mount: mountOneTouch };
  global.mountOneTouch = mountOneTouch;
})(window);
