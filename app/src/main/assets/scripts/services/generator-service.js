/* =========================================================================
 * MF.GeneratorService — request building + engine delegation
 * -------------------------------------------------------------------------
 * The UI (generator page) collects inputs; THIS service owns request
 * validation and forwards generation to the engine contract. The source's
 * randChar/randomLocalPart/nameBasedLocalPart/genEmail/genPassword random
 * business generators were the fake production path and are gone — no
 * account data is ever produced in the UI layer (task §6, §7).
 *
 * Validation bounds mirror the source's UI policy exactly:
 *   email length ≥ 3, password length ≥ 4, batch quantity 1–200,
 *   name pattern trimmed/limited to 20 chars by the inputs themselves.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};
  var COMMANDS = MF.engineContracts.COMMANDS;

  function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  // Domain is a CONFIG-DRIVEN HINT (engine-owned decision), not a rule the
  // UI enforces. See config/app-config.js -> engine.generationDomainHint.

  function buildSingleRequest(inputs) {
    return {
      mode: 'single',
      namePattern: String(inputs.namePattern || '').trim(),
      emailLength: Math.max(3, toInt(inputs.emailLength, 10)),
      passwordLength: Math.max(4, toInt(inputs.passwordLength, 12)),
      domainHint: MF.config.engine.generationDomainHint || undefined
    };
  }

  function buildBatchRequest(inputs) {
    return {
      mode: 'batch',
      namePattern: String(inputs.namePattern || '').trim(),
      emailLength: Math.max(3, toInt(inputs.emailLength, 10)),
      passwordLength: Math.max(4, toInt(inputs.passwordLength, 12)),
      quantity: Math.max(1, Math.min(200, toInt(inputs.quantity, 10))),
      domainHint: MF.config.engine.generationDomainHint || undefined
    };
  }

  MF.GeneratorService = {
    buildSingleRequest: buildSingleRequest,
    buildBatchRequest: buildBatchRequest,

    /**
     * Promise<{ mode, items:[{email,password}] }> — resolves ONLY with real
     * engine output. Rejects with EngineError('ENGINE_UNAVAILABLE') while
     * no engine is attached.
     */
    generate: function (request) {
      var command = request.mode === 'batch' ? COMMANDS.GENERATE_BATCH : COMMANDS.GENERATE_SINGLE;
      return MF.engine.execute(command, { request: request }).then(function (result) {
        var items = result && Array.isArray(result.items) ? result.items : null;
        if (!items) {
          throw new MF.EngineError('INVALID_RESPONSE', 'Engine returned no result items');
        }
        // Defensive shape check — only well-formed records pass to the UI.
        var clean = items.filter(function (it) {
          return it && typeof it.email === 'string' && it.email &&
                 typeof it.password === 'string' && it.password;
        });
        if (request.mode === 'batch' && clean.length !== items.length) {
          throw new MF.EngineError('INVALID_RESPONSE', 'Engine returned malformed batch items');
        }
        return { mode: request.mode, items: clean };
      });
    }
  };
})(window);
