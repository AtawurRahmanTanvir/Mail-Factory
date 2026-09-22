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
 * NEXUS Engine 05: MEMORY PURGE (Upgraded)
 * Production-Ready: Includes RAM Defragmentation, Safe Streams, and Coroutine Cancellation.
 */
object MemoryPurgeEngine {

    private const val TAG = "NEXUS_MemoryPurge"
    private const val COMMAND_TIMEOUT_SECONDS = 15L

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    suspend fun executeMemoryPurge(): Boolean = withContext(Dispatchers.IO) {
        var process: java.lang.Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val currentPid = Process.myPid()
                val script = buildString {
                    append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                    append("am kill-all\n")
                    append("sync\n")
                    append("if [ -w /proc/sys/vm/drop_caches ]; then echo 3 > /proc/sys/vm/drop_caches; fi\n")
                    append("if [ -w /proc/sys/vm/compact_memory ]; then echo 1 > /proc/sys/vm/compact_memory; fi\n")
                    append("logcat -c\n")
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
                LogEngine.postLog(TAG, "Memory Purge: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "Memory Purge: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "Memory Purge: SUCCESS (RAM Freed & Optimized)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "Memory Purge: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}