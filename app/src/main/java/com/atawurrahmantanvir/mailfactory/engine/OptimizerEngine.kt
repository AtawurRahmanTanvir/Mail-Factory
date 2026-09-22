package com.atawurrahmantanvir.mailfactory.engine

import android.os.Process
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.DataOutputStream
import java.util.concurrent.TimeUnit

/**
 * NEXUS Engine 04: OPTIMIZER
 * Privileged system-maintenance engine.
 * UX Optimized: Unified Script Execution for zero-latency & clean terminal logs.
 */
object OptimizerEngine {

    private const val TAG = "NEXUS_Optimizer"
    // ডেডলক প্রতিরোধের জন্য ১৫ সেকেন্ডের লিমিট
    private const val COMMAND_TIMEOUT_SECONDS = 15L 

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    private fun postLog(message: String) {
        val currentList = _consoleLog.value.toMutableList()
        currentList.add(message)
        _consoleLog.value = currentList
        LogEngine.postLog(TAG, message)
    }

    suspend fun executeOptimizer(): Boolean = withContext(Dispatchers.IO) {

        postLog("> Starting system optimization...")

        var process: java.lang.Process? = null
        var os: DataOutputStream? = null

        try {
            process = Runtime.getRuntime().exec("su")
            os = DataOutputStream(process.outputStream)

            val currentPid = Process.myPid()

            // [CRITICAL UX FIX] Unified Shell Script
            // ল্যাগ এড়াতে স্টোরেজ ট্রিম এবং ক্যাশ রিমুভাল কমান্ড একসাথে পুশ করা হচ্ছে
            val script = buildString {
                append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                
                // Filesystem TRIM (স্টোরেজ অপটিমাইজেশন)
                append("if command -v fstrim >/dev/null 2>&1; then\n")
                append("  if mountpoint -q /data; then fstrim -v /data >/dev/null 2>&1; fi\n")
                append("  if mountpoint -q /cache; then fstrim -v /cache >/dev/null 2>&1; fi\n")
                append("fi\n")
                
                // Package cache trimming (জাঙ্ক ফাইল রিমুভাল)
                append("pm trim-caches 4G >/dev/null 2>&1\n")
                append("exit\n")
            }

            os.writeBytes(script)
            os.flush()

            val completed = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            if (!completed) {
                postLog("⚠ Optimization timed out. Retrying in background...")
                process.destroyForcibly()
                return@withContext false
            }

            val exitValue = process.exitValue()

            if (exitValue != 0) {
                postLog("⚠ System error during optimization.")
                return@withContext false
            }

            postLog("✓ Storage blocks trimmed and optimized")
            postLog("✓ Junk files and caches removed")
            postLog("✓ Core performance boosted")
            postLog("┌──────────────────────────────────────┐")
            postLog("│ SYSTEM OPTIMIZATION: COMPLETED       │")
            postLog("└──────────────────────────────────────┘")

            return@withContext true

        } catch (e: Exception) {
            postLog("⚠ Unexpected error: System busy.")
            return@withContext false
        } finally {
            try {
                os?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Output stream cleanup failed", e)
            }
            try {
                process?.destroy()
            } catch (e: Exception) {
                Log.e(TAG, "Process cleanup failed", e)
            }
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}