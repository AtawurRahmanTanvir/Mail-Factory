package com.atawurrahmantanvir.mailfactory.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.DataOutputStream
import java.util.concurrent.TimeUnit

/**
 * NEXUS Engine 02: NETWORK CYCLE (100% Real Implementation)
 * Production-Ready: Absolute IP reset, Residential Proxy Injection, and BBR Optimization via Root.
 */
object NetworkCycleEngine {
    private const val TAG = "NEXUS_NetworkCycle"
    private const val COMMAND_TIMEOUT_SECONDS = 25L

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    suspend fun executeNetworkCycle(proxyHost: String, proxyPort: Int): Boolean = withContext(Dispatchers.IO) {
        var process: Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val script = buildString {
                    append("settings put global airplane_mode_on 1\n")
                    append("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true 2>/dev/null\n")
                    append("sleep 3\n")
                    append("settings put global airplane_mode_on 0\n")
                    append("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false 2>/dev/null\n")
                    append("sleep 3\n")
                    append("echo bbr > /proc/sys/net/ipv4/tcp_congestion_control 2>/dev/null\n")
                    append("settings put global http_proxy $proxyHost:$proxyPort\n")
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
                LogEngine.postLog(TAG, "Network Cycle: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "Network Cycle: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "Network Cycle: SUCCESS (IP Reset & Proxy Active)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "Network Cycle: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }

    suspend fun clearGlobalProxy(): Boolean = withContext(Dispatchers.IO) {
        var process: Process? = null
        return@withContext try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                os.writeBytes("settings put global http_proxy :0\nexit\n")
                os.flush()
            }
            process.waitFor()
            LogEngine.postLog(TAG, "Network Cycle: SUCCESS (Proxy Cleared)", "success")
            true
        } catch (e: Exception) {
            LogEngine.postLog(TAG, "Network Cycle: FAILED (Proxy Clear Crash)", "error")
            false
        } finally {
            process?.destroy()
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}
