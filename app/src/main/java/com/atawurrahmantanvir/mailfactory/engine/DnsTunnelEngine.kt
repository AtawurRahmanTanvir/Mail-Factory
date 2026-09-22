package com.atawurrahmantanvir.mailfactory.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.DataOutputStream

object DnsTunnelEngine {
    private const val TAG = "NEXUS_DnsTunnel"
    private const val COMMAND_TIMEOUT_SECONDS = 15L

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }

    suspend fun executeDnsTunnel(): Boolean = withContext(Dispatchers.IO) {
        var process: Process? = null
        try {
            process = Runtime.getRuntime().exec("su")
            DataOutputStream(process.outputStream).use { os ->
                val script = buildString {
                    append("iptables -t nat -D OUTPUT -p udp --dport 53 -j DNAT --to-destination 1.1.1.1:53 2>/dev/null\n")
                    append("iptables -t nat -D OUTPUT -p tcp --dport 53 -j DNAT --to-destination 1.1.1.1:53 2>/dev/null\n")
                    append("iptables -t nat -I OUTPUT -p udp --dport 53 -j DNAT --to-destination 1.1.1.1:53\n")
                    append("iptables -t nat -I OUTPUT -p tcp --dport 53 -j DNAT --to-destination 1.1.1.1:53\n")
                    append("ip6tables -P INPUT DROP 2>/dev/null\n")
                    append("ip6tables -P OUTPUT DROP 2>/dev/null\n")
                    append("ip6tables -P FORWARD DROP 2>/dev/null\n")
                    append("ndc resolver clearnetdns 2>/dev/null\n")
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
                LogEngine.postLog(TAG, "DNS Tunnel: FAILED (Timeout)", "error")
                process.destroy()
                return@withContext false
            }

            if (process.exitValue() != 0) {
                LogEngine.postLog(TAG, "DNS Tunnel: FAILED (Root Denied)", "error")
                return@withContext false
            }

            LogEngine.postLog(TAG, "DNS Tunnel: SUCCESS (Cloudflare 1.1.1.1 Active)", "success")
            return@withContext true

        } catch (e: Exception) {
            LogEngine.postLog(TAG, "DNS Tunnel: FAILED (Crash)", "error")
            return@withContext false
        } finally {
            process?.destroy()
        }
    }
}
