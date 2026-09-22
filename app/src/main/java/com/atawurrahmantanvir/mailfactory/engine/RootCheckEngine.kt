package com.atawurrahmantanvir.mailfactory.engine

import android.os.Build
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * NEXUS Engine: ROOT CHECK
 * Multi-layer local root capability assessment.
 * UX Optimized: Added terminal logging flow for UI feedback.
 */
object RootCheckEngine {

    private const val TAG = "NEXUS_RootCheck"
    private const val COMMAND_TIMEOUT_SECONDS = 5L

    // টার্মিনালে ইউজার-ফ্রেন্ডলি লগ দেখানোর জন্য StateFlow অ্যাড করা হলো
    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    private fun postLog(message: String) {
        val currentList = _consoleLog.value.toMutableList()
        currentList.add(message)
        _consoleLog.value = currentList
        LogEngine.postLog(TAG, message)
    }

    data class RootStatus(
        val rootAvailable: Boolean,
        val uid: Int?,
        val gid: Int?,
        val selinuxContext: String?,
        val selinuxEnforcing: Boolean?,
        val testKeysDetected: Boolean,
        val suPathDetected: Boolean,
        val suExecutableAvailable: Boolean,
        val shellExitCode: Int?,
        val timedOut: Boolean,
        val error: String? = null
    )

    suspend fun checkRootStatus(): RootStatus = withContext(Dispatchers.IO) {

        postLog("> Verifying system privileges...")

        // Tier 1: Build-tag heuristic
        val testKeysDetected = checkBuildTags()

        // Tier 2: Known su-path heuristic
        val suPathDetected = checkKnownSuPaths()

        // Tier 3: Actual su executable availability + execution
        val execution = executeRootProbe()

        val rootAvailable = execution.exitCode == 0 && execution.uid == 0

        if (rootAvailable) {
            postLog("✓ Root access verified")
            postLog("✓ Core engine access granted")
        } else {
            postLog("⚠ Root access not found")
            postLog("⚠ Running in restricted mode")
        }

        return@withContext RootStatus(
            rootAvailable = rootAvailable,
            uid = execution.uid,
            gid = execution.gid,
            selinuxContext = execution.selinuxContext,
            selinuxEnforcing = execution.selinuxEnforcing,
            testKeysDetected = testKeysDetected,
            suPathDetected = suPathDetected,
            suExecutableAvailable = execution.suExecutableAvailable,
            shellExitCode = execution.exitCode,
            timedOut = execution.timedOut,
            error = execution.error
        )
    }

    /**
     * Convenience API for existing NEXUS callers that only need a Boolean.
     */
    suspend fun isDeviceRooted(): Boolean {
        return checkRootStatus().rootAvailable
    }

    private fun checkBuildTags(): Boolean {
        val tags = Build.TAGS ?: return false
        return tags
            .split(",")
            .map { it.trim() }
            .any { it == "test-keys" }
    }

    private fun checkKnownSuPaths(): Boolean {
        val knownPaths = arrayOf(
            "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/system_ext/bin/su", "/product/bin/su", "/vendor/bin/su",
            "/data/local/su", "/data/local/bin/su", "/data/local/xbin/su", "/su/bin/su"
        )

        for (path in knownPaths) {
            try {
                if (File(path).exists()) return true
            } catch (e: SecurityException) {
                Log.w(TAG, "Unable to inspect $path")
            }
        }
        return false
    }

    private fun executeRootProbe(): RootProbeResult {
        var process: Process? = null
        var reader: BufferedReader? = null

        return try {
            // Already a unified, single-execution string. Extremely fast.
            process = Runtime.getRuntime().exec(
                arrayOf(
                    "su", "-c",
                    "printf 'UID='; id -u; printf 'GID='; id -g; printf 'CTX='; id -Z 2>/dev/null; printf 'SELINUX='; getenforce 2>/dev/null"
                )
            )

            reader = BufferedReader(InputStreamReader(process.inputStream))

            val completed = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            if (!completed) {
                Log.w(TAG, "[TIER-3] su command timed out.")
                process.destroyForcibly()
                return RootProbeResult(
                    suExecutableAvailable = true, uid = null, gid = null,
                    selinuxContext = null, selinuxEnforcing = null, exitCode = null,
                    timedOut = true, error = "Root shell timed out."
                )
            }

            val output = reader.readText().trim()
            val exitCode = process.exitValue()

            val values = parseRootProbe(output)
            val selinuxEnforcing = when (values["SELINUX"]?.trim()?.uppercase()) {
                "ENFORCING" -> true
                "PERMISSIVE" -> false
                else -> null
            }

            RootProbeResult(
                suExecutableAvailable = true,
                uid = values["UID"]?.toIntOrNull(),
                gid = values["GID"]?.toIntOrNull(),
                selinuxContext = values["CTX"]?.takeIf { it.isNotBlank() },
                selinuxEnforcing = selinuxEnforcing,
                exitCode = exitCode,
                timedOut = false,
                error = null
            )

        } catch (e: IOException) {
            RootProbeResult(
                suExecutableAvailable = false, uid = null, gid = null,
                selinuxContext = null, selinuxEnforcing = null, exitCode = null,
                timedOut = false, error = e.localizedMessage
            )
        } catch (e: Exception) {
            RootProbeResult(
                suExecutableAvailable = true, uid = null, gid = null,
                selinuxContext = null, selinuxEnforcing = null, exitCode = null,
                timedOut = false, error = e.localizedMessage
            )
        } finally {
            try { reader?.close() } catch (_: Exception) {}
            try { process?.destroy() } catch (_: Exception) {}
        }
    }

    private fun parseRootProbe(output: String): Map<String, String> {
        val result = mutableMapOf<String, String>()
        val regex = Regex("(UID|GID|CTX|SELINUX)=([^\\n]*?)(?=(?:UID|GID|CTX|SELINUX)=|$)")
        regex.findAll(output).forEach { match ->
            val key = match.groupValues[1]
            val value = match.groupValues[2].trim()
            result[key] = value
        }
        return result
    }

    private data class RootProbeResult(
        val suExecutableAvailable: Boolean,
        val uid: Int?,
        val gid: Int?,
        val selinuxContext: String?,
        val selinuxEnforcing: Boolean?,
        val exitCode: Int?,
        val timedOut: Boolean,
        val error: String?
    )

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}