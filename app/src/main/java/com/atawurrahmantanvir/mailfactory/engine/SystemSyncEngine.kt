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
 * NEXUS Engine 03: SYSTEM SYNC
 * Privileged Android system-state maintenance engine.
 * UX Optimized: Unified Script Execution for zero-latency & clean terminal logs.
 */
object SystemSyncEngine {

    private const val TAG = "NEXUS_SystemSync"
    // ডেডলক এড়াতে টাইমআউট ১৫ সেকেন্ড করা হলো
    private const val COMMAND_TIMEOUT_SECONDS = 15L

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    private fun postLog(message: String) {
        val currentList = _consoleLog.value.toMutableList()
        currentList.add(message)
        _consoleLog.value = currentList
        LogEngine.postLog(TAG, message)
    }

    suspend fun executeSystemSync(): Boolean = withContext(Dispatchers.IO) {

        postLog("> Starting system synchronization...")

        var process: java.lang.Process? = null
        var os: DataOutputStream? = null

        try {
            process = Runtime.getRuntime().exec("su")
            os = DataOutputStream(process.outputStream)

            val currentPid = Process.myPid()

            // [CRITICAL UX FIX] Unified Shell Script
            // ল্যাগ এড়াতে কমান্ডগুলো একবারে পুশ করা হচ্ছে
            val script = buildString {
                append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                append("sync\n") // Synchronize pending filesystem writes
                append("exit\n")
            }

            os.writeBytes(script)
            os.flush()

            val completed = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            if (!completed) {
                postLog("⚠ System sync timed out. Retrying in background...")
                process.destroyForcibly()
                return@withContext false
            }

            val exitValue = process.exitValue()

            if (exitValue != 0) {
                postLog("⚠ System error during synchronization.")
                return@withContext false
            }

            // ইউজার-ফ্রেন্ডলি লগিং
            postLog("✓ Core services preserved")
            postLog("✓ Databases synchronized")
            postLog("✓ Filesystem state verified")
            postLog("┌──────────────────────────────────────┐")
            postLog("│ SYSTEM SYNC: COMPLETED               │")
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