/* =========================================================================
 * ENGINE CONTRACT — the hard UI/engine boundary
 * -------------------------------------------------------------------------
 * This file defines the ONLY interface through which the future private
 * native engine connects to this frontend. It deliberately contains no
 * engine implementation (matrix §5, §28, §38).
 *
 *   UI Controller  →  MF.engine (facade)  →  EngineAdapter (this contract)
 *                                            ├─ EngineBridge      (Android WebView JS interface)
 *                                            ├─ registerAdapter() (any custom adapter)
 *                                            └─ UnavailableEngineAdapter (current default)
 *
 * The contract is derived from what the UI actually needs today:
 *
 *   available()                      boolean — is a real engine attached?
 *   info()                           { name, version, contractVersion }
 *   getStatus()     : Promise   → EngineStatus { ready:boolean, detail?:string }
 *   getSettings()   : Promise   → { [engineId:string]: boolean } | null
 *   setEngineEnabled(id, on) : Promise<void>
 *   execute(command, payload) : Promise<result>
 *        commands observed from the UI:
 *          'optimizeSystem'            (Engine — OPTIMIZE SYSTEM)
 *          'createAccount'             (Engine — CREATE ACCOUNT)
 *          'generateSingle'  { request }  (Generator — single tab)
 *          'generateBatch'   { request }  (Generator — batch tab)
 *   subscribeLogs(listener(entry)) : unsubscribe()   ← engine event stream
 *   cancel(operationId)            : Promise<void>
 *
 * Rules for any future adapter:
 *  - Resolve asynchronously; never block the UI thread.
 *  - Reject with an Error carrying `.code` ('ENGINE_UNAVAILABLE',
 *    'TIMEOUT', 'CANCELLED', 'INVALID_RESPONSE', …).
 *  - Push log entries only for events that really happened:
 *        { tag:'SYSTEM', text:'…', level:'ok'|'info'|'error', time:ISOString }
 *  - Never present simulated progress or fabricated results.
 *  - Evolve freely: the UI depends on this contract, not on internals.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  MF.engineContracts = MF.engineContracts || {};

  /** Machine-readable contract version — bumped when the shape changes. */
  MF.engineContracts.ENGINE_ADAPTER_VERSION = 1;

  /** Error used across the boundary. UI maps codes to truthful messages. */
  MF.EngineError = function EngineError(code, message) {
    var err = new Error(message || code);
    err.name = 'EngineError';
    err.code = code;
    return err;
  };

  MF.engineContracts.COMMANDS = {
    OPTIMIZE_SYSTEM: 'optimizeSystem',
    CREATE_ACCOUNT: 'createAccount',
    GENERATE_SINGLE: 'generateSingle',
    GENERATE_BATCH: 'generateBatch'
  };
})(window);
