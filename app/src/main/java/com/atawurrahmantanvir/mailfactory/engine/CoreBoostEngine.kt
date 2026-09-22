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
 * NEXUS Engine 08: CORE BOOST
 * CPU Governor tuning, core wake-lock, and raw performance overdrive engine.
 * UX Optimized: Unified Script Execution & clean terminal logs.
 */
object CoreBoostEngine {

    private const val TAG = "NEXUS_CoreBoost"
    private const val COMMAND_TIMEOUT_SECONDS = 10L

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    suspend fun executeCoreBoost(): Boolean = withContext(Dispatchers.IO) {
        var process: java.lang.Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val currentPid = Process.myPid()
                val script = buildString {
                    append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                    append("for i in 0 1 2 3 4 5 6 7; do echo 1 > /sys/devices/system/cpu/cpu\$i/online 2>/dev/null; done\n")
                    append("for gov in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo performance > \$gov 2>/dev/null; done\n")
                    append("for scheduler in /sys/block/*/queue/scheduler; do echo deadline > \$scheduler 2>/dev/null; done\n")
                    append("echo 10 > /proc/sys/vm/swappiness 2>/dev/null\n")
                    append("echo performance > /sys/class/kgsl/kgsl-3d0/devfreq/governor 2>/dev/null\n")
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
                LogEngine.postLog(TAG, "Core Boost: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "Core Boost: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "Core Boost: SUCCESS (Performance Mode Active)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "Core Boost: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}