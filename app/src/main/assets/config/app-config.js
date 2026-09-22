/* =========================================================================
 * MAIL FACTORY — central application configuration
 * -------------------------------------------------------------------------
 * Single source of truth for release metadata, external destinations,
 * network targets and default engine settings.
 *
 * RULES (see docs/ARCHITECTURE.md):
 *  - No URL in this file may be invented. Values are either carried over
 *    verbatim from the original `mail-factory.html` source (marked REAL)
 *    or left as `null` until the product owner supplies the real value.
 *  - UI modules must read destinations from here — never hardcode URLs.
 *  - A `null` link means "not configured": the UI says so truthfully and
 *    never fakes a working destination.
 * ========================================================================= */
(function (global) {
  'use strict';

  global.MF = global.MF || {};
  global.MF.config = {

    /** App release identity (was inline constant CURRENT_VERSION / markup). */
    version: {
      current: '1.0.0',            // REAL — carried from source
      label: 'Stable'              // REAL — version page badge copy
    },

    /** GitHub repository used by the real Releases API integration. */
    github: {
      repo: 'MailFactoryLabs/MailFactoryLabs.github.io',   // REAL — carried from source
      apiReleasesBase: 'https://api.github.com/repos/',    // REAL — GitHub REST API (from source)
      htmlBase: 'https://github.com/',                     // REAL — GitHub web base (from source)
      website: 'https://mailfactorylabs.github.io',        // REAL — carried from source
      issues: 'https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues',       // REAL — carried from source
      newIssue: 'https://github.com/MailFactoryLabs/MailFactoryLabs.github.io/issues/new', // REAL — carried from source
      shareUrl: 'https://github.com/MailFactoryLabs/MailFactoryLabs.github.io',            // REAL — carried from source
      // Short display form shown in the Share page link row (REAL — same string as source).
      shareDisplay: 'github.com/MailFactoryLabs/MailFactoryLabs.github.io'
    },

    /**
     * External destinations. Every value below that is `null` was NOT
     * configured in the source either (the source showed placeholder
     * toasts, which were removed). Supply the real URL to activate the
     * corresponding button — no code changes needed.
     */
    links: {
      feedback:   null,   // Send Feedback -> Post Feedback destination
      telegram:   null,   // Help & Support community / Contact Us
      facebook:   null,   // Help & Support community / Contact Us
      whatsapp:   null,   // Contact Us
      youtube:    null,   // Contact Us
      contactEmail: null, // Contact Us -> Email (mailto target; was CONTACT_EMAIL = null in source)
      rating:     null    // Rate the App -> external store/ratings destination
    },

    /** Real network check used by Engine -> Check Route (carried from source). */
    network: {
      routeCheck: {
        targetHost: 'www.cloudflare.com',                    // REAL — carried from source
        targetUrl: 'https://www.cloudflare.com/cdn-cgi/trace', // REAL — carried from source
        timeoutMs: 6000,      // REAL — request timeout from source
        minDurationMs: 1500   // REAL — minimum animation duration from source
      }
    },

    /**
     * Engine System Settings defaults. Values match the initial switch
     * state in the original markup (identity/network/repo/dns ON,
     * boost/memory OFF). With no engine connected these are persisted
     * locally and applied to the engine once it is integrated.
     */
    engine: {
      contractVersion: 1,
      /**
       * REAL — the source generator emitted addresses at @example.com, so
       * requests carry this value as a HINT for behavioural continuity.
       * This is NOT a production business rule: the PRIVATE ENGINE owns the
       * final domain decision and may ignore or override the hint. Set to
       * null to omit the field from requests entirely.
       */
      generationDomainHint: 'example.com',
      defaultSettings: {
        identity: true,
        network: true,
        repo: true,
        boost: false,
        memory: false,
        dns: true
      }
    },

    /** Language list (REAL — exact list and order from source). */
    languages: [
      'English', 'বাংলা', 'हिन्दी', 'العربية', 'Español', 'Português',
      'Français', 'Deutsch', 'Italiano', 'Türkçe', 'Русский', 'Українська',
      '中文', '日本語', '한국어', 'ไทย', 'Tiếng Việt', 'Bahasa Indonesia',
      'Nederlands', 'Polski'
    ],

    /** Share sheet copy (REAL — carried from source shareApp()). */
    share: {
      title: 'Mail Factory',
      text: 'Check out Mail Factory — an experimental automation project.'
    },

    /** Storage keys (namespaced, versioned). See docs/ARCHITECTURE.md. */
    storage: {
      language: 'mailFactoryLanguage',          // REAL — key carried from source
      library: 'mailFactory.library.v1',        // NEW — versioned library store
      engineSettings: 'mailFactory.engineSettings.v1',
      rating: 'mailFactory.rating.v1'
    }
  };
})(window);
