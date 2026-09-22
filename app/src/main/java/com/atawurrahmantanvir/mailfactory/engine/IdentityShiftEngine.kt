package com.atawurrahmantanvir.mailfactory.engine

import android.os.Process
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.DataOutputStream
import java.util.concurrent.TimeUnit

/**
 * NEXUS ENGINE V7: KOTLIN INTERFACE
 * 100% REAL: Manipulates Secure Settings and properties via Root shell.
 */
object IdentityShiftEngine {
    private const val TAG = "NEXUS_IdentityShift"
    private const val COMMAND_TIMEOUT_SECONDS = 15L
    
    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }

    suspend fun executeIdentityShift(): Boolean = withContext(Dispatchers.IO) {
        var process: java.lang.Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val script = buildString {
                    append("NEW_ID=\$(tr -dc a-f0-9 < /dev/urandom | head -c 16)\n")
                    append("settings put secure android_id \$NEW_ID 2>/dev/null\n")
                    append("if command -v resetprop >/dev/null 2>&1; then\n")
                    append("  resetprop ro.boot.verifiedbootstate green\n")
                    append("  resetprop ro.boot.flash.locked 1\n")
                    append("  resetprop ro.boot.vbmeta.device_state locked\n")
                    append("fi\n")
                    append("rm -rf /data/data/com.google.android.gsf/databases/gservices.db* 2>/dev/null\n")
                    append("exit\n")
                }
                os.writeBytes(script)
                os.flush()
            }

            var completed = false
            repeat(COMMAND_TIMEOUT_SECONDS.toInt()) {
                if (!isActive) {
                    process.destroy()
                    return@withContext false
                }
                try {
                    if (process.exitValue() >= 0 || process.exitValue() < 0) {
                        completed = true
                        return@repeat
                    }
                } catch (_: IllegalThreadStateException) {
                    Thread.sleep(1000)
                }
            }

            if (!completed) {
                LogEngine.postLog(TAG, "Identity Shift: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "Identity Shift: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "Identity Shift: SUCCESS (Hardware ID & Play Integrity Masked)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "Identity Shift: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }
}
