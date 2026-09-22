package com.atawurrahmantanvir.mailfactory.engine

import android.os.Process
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * NEXUS Engine 07: BROWSER PURGE
 * High-speed local browser-data maintenance engine.
 * UX Optimized: Unified Script Execution for zero-latency & clean terminal logs.
 */
object BrowserPurgeEngine {

    private const val TAG = "NEXUS_BrowserPurge"
    // হ্যাং হওয়া ঠেকাতে লিমিট ১৫ সেকেন্ড করা হলো
    private const val COMMAND_TIMEOUT_SECONDS = 15L 

    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    private val supportedBrowsers = linkedMapOf(
        "com.android.chrome" to "Google Chrome",
        "org.mozilla.firefox" to "Mozilla Firefox",
        "com.brave.browser" to "Brave",
        "com.microsoft.emmx" to "Microsoft Edge",
        "com.opera.browser" to "Opera",
        "com.kiwibrowser.browser" to "Kiwi Browser",
        "mark.via" to "Via Browser",
        "com.android.browser" to "Android Browser"
    )

    private fun postLog(message: String) {
        val currentList = _consoleLog.value.toMutableList()
        currentList.add(message)
        _consoleLog.value = currentList
        LogEngine.postLog(TAG, message)
    }

    suspend fun executeBrowserPurge(
        packages: List<String> = supportedBrowsers.keys.toList()
    ): Boolean = withContext(Dispatchers.IO) {

        postLog("> Starting Cache & Browser Cleanup...")

        var process: java.lang.Process? = null
        var os: DataOutputStream? = null
        var stdoutReader: BufferedReader? = null

        try {
            val requestedPackages = packages.distinct().filter { it in supportedBrowsers }

            if (requestedPackages.isEmpty()) {
                postLog("⚠ No supported browsers selected.")
                return@withContext false
            }

            process = Runtime.getRuntime().exec("su")
            os = DataOutputStream(process.outputStream)
            stdoutReader = BufferedReader(InputStreamReader(process.inputStream))

            val currentPid = Process.myPid()
            
            // [CRITICAL UX FIX] Unified Shell Script
            // ল্যাগ এড়ানোর জন্য একবারে একটি সিঙ্গেল স্ক্রিপ্ট ব্লকে সব কমান্ড পাঠানো হচ্ছে
            val script = buildString {
                append("echo -1000 > /proc/$currentPid/oom_score_adj 2>/dev/null\n")
                for (pkg in requestedPackages) {
                    append("if pm path $pkg >/dev/null 2>&1; then\n")
                    append("  echo NEXUS_INSTALLED:$pkg\n")
                    append("  if pm clear $pkg >/dev/null 2>&1; then\n")
                    append("    echo NEXUS_CLEAR_OK:$pkg\n")
                    append("  else\n")
                    append("    echo NEXUS_CLEAR_FAILED:$pkg\n")
                    append("  fi\n")
                    append("fi\n") // Missing app গুলো ইগনোর করা হবে যাতে লগে আবর্জনা না থাকে
                }
                append("sync\n")
                append("exit\n")
            }

            // স্ক্রিপ্ট পুশ করা হলো
            os.writeBytes(script)
            os.flush()

            // টাইমআউট এবং ডেডলক প্রোটেকশন
            val completed = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            if (!completed) {
                postLog("⚠ Cleanup operation timed out. Retrying in background...")
                process.destroyForcibly()
                return@withContext false
            }

            postLog("✓ Cleanup process secured")

            var successCount = 0
            var failedCount = 0
            var foundAny = false

            // একবারে সব আউটপুট রিড করা হচ্ছে
            val outputLines = stdoutReader.readLines()
            
            for (line in outputLines) {
                when {
                    line.startsWith("NEXUS_INSTALLED:") -> {
                        foundAny = true
                        val pkg = line.removePrefix("NEXUS_INSTALLED:")
                        val name = supportedBrowsers[pkg] ?: pkg
                        postLog("> Wiping data for: $name")
                    }
                    line.startsWith("NEXUS_CLEAR_OK:") -> {
                        val pkg = line.removePrefix("NEXUS_CLEAR_OK:")
                        val name = supportedBrowsers[pkg] ?: pkg
                        postLog("  ✓ $name footprint wiped")
                        successCount++
                    }
                    line.startsWith("NEXUS_CLEAR_FAILED:") -> {
                        failedCount++
                    }
                }
            }

            if (!foundAny) {
                postLog("✓ No supported browsers found. System clean.")
                postLog("┌──────────────────────────────────────┐")
                postLog("│ BROWSER CLEANUP: DONE                │")
                postLog("└──────────────────────────────────────┘")
                return@withContext true
            }

            postLog("✓ System storage synchronized")

            if (failedCount > 0) {
                postLog("⚠ Finished with $failedCount skipped file(s).")
                return@withContext false
            }

            postLog("┌──────────────────────────────────────┐")
            postLog("│ BROWSER CLEANUP: DONE                │")
            postLog("└──────────────────────────────────────┘")
            return@withContext true

        } catch (e: Exception) {
            postLog("⚠ Unexpected error: System busy.")
            return@withContext false
        } finally {
            try { stdoutReader?.close() } catch (e: Exception) { }
            try { os?.close() } catch (e: Exception) { }
            try { process?.destroy() } catch (e: Exception) { }
        }
    }

    fun getSupportedBrowsers(): Map<String, String> {
        return supportedBrowsers.toMap()
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}