package com.atawurrahmantanvir.mailfactory.engine

import android.os.Process
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.DataOutputStream
import java.util.concurrent.TimeUnit

/**
 * NEXUS Engine 07: SYSTEM REPO
 * Deep storage maintenance, hardware trimming, and junk purge engine.
 * UX Optimized: Unified Script Execution & clean terminal logs.
 */
object SystemRepoEngine {

    private const val TAG = "NEXUS_SystemRepo"
    private const val COMMAND_TIMEOUT_SECONDS = 20L // স্টোরেজ ট্রিমিংয়ে কিছুটা সময় লাগতে পারে

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    suspend fun executeRepoMaintenance(): Boolean = withContext(Dispatchers.IO) {
        var process: java.lang.Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val currentPid = Process.myPid()
                val script = buildString {
                    append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                    append("sm fstrim 2>/dev/null\n")
                    append("pm trim-caches 128G 2>/dev/null\n")
                    append("rm -rf /data/local/tmp/* 2>/dev/null\n")
                    append("rm -rf /cache/* 2>/dev/null\n")
                    append("rm -rf /data/system/dropbox/* 2>/dev/null\n")
                    append("rm -rf /data/tombstones/* 2>/dev/null\n")
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
                LogEngine.postLog(TAG, "System Repo: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "System Repo: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "System Repo: SUCCESS (Deep Maintained)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "System Repo: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}