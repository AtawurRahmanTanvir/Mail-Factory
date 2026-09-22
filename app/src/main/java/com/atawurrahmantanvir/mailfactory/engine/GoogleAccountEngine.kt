package com.atawurrahmantanvir.mailfactory.engine

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * NEXUS Engine: GOOGLE ACCOUNT (INJECTION MOD)
 * Supports multiple entry points: Standard Settings & YouTube Backdoor.
 */
class GoogleAccountEngine(
    private val activity: Activity
) {
    private val TAG = "NEXUS_GoogleAccount"
    private val _consoleLog = MutableStateFlow<List<String>>(emptyList())
    val consoleLog: StateFlow<List<String>> = _consoleLog

    private fun postLog(message: String) {
        val currentList = _consoleLog.value.toMutableList()
        currentList.add(message)
        _consoleLog.value = currentList
        LogEngine.postLog(TAG, message)
    }

    /**
     * METHOD 1: Standard Android Flow
     */
    fun openStandardFlow(): Boolean {
        return try {
            postLog("> Launching Standard Gateway...")
            val intent = Intent(Settings.ACTION_ADD_ACCOUNT)
            intent.putExtra(Settings.EXTRA_ACCOUNT_TYPES, arrayOf("com.google"))
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            activity.startActivity(intent)
            postLog("✓ Standard flow initiated")
            true
        } catch (e: Exception) {
            postLog("⚠ Standard gateway failed.")
            false
        }
    }

    /**
     * METHOD 2: YouTube Injection Flow (The Backdoor)
     * Launches account creation via YouTube internal intent.
     * Often bypasses strict phone verification checks.
     */
    fun openYouTubeFlow(): Boolean {
        return try {
            postLog("> Injecting via YouTube Gateway...")
            
            // ইউটিউব অ্যাপের অথেন্টিকেশন ফ্লো ট্রিগার করা
            val intent = Intent(Intent.ACTION_VIEW)
            intent.setClassName("com.google.android.youtube", "com.google.android.apps.youtube.app.application.Shell\$HomeActivity")
            intent.data = Uri.parse("https://youtube.com")
            intent.putExtra("launch_sign_in", true)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            
            activity.startActivity(intent)
            
            postLog("✓ YouTube injection successful")
            postLog("ℹ Hint: Click 'Add Account' inside YouTube if prompted.")
            true
        } catch (e: Exception) {
            // ইউটিউব না থাকলে ফলব্যাক হিসেবে ব্রাউজার বা সেটিংস ট্রাই করবে
            postLog("⚠ YouTube app not found. Switching to backup...")
            return openStandardFlow()
        }
    }

    fun clearConsole() {
        _consoleLog.value = emptyList()
    }
}
