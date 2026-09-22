package com.atawurrahmantanvir.mailfactory.engine

import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

object AutoVerifyEngine {
    fun checkAndVerifyAccounts(webView: WebView) {
        CoroutineScope(Dispatchers.IO).launch {
            val context = webView.context
            val backupDir = File(context.filesDir, "Backup")
            val localStorageProvider = LocalStorageProvider(backupDir)
            val unverifiedFile = File(backupDir, "Not_Verified.txt")
            
            if (!unverifiedFile.exists()) return@launch

            val lines = unverifiedFile.readLines()
            for (line in lines) {
                if (line.isBlank()) continue
                val parts = line.split("|")
                if (parts.size >= 2) {
                    val email = parts[0].trim()
                    val password = parts[1].trim()
                    
                    val isVerified = RootVerificationEngine.verifySpecificAccountAdded(email)
                    if (isVerified) {
                        localStorageProvider.moveToVerified(email, password)
                        LogEngine.postLog("AutoVerifyEngine", "[AUTO-VERIFY] Account verified & backed up: $email")
                        
                        withContext(Dispatchers.Main) {
                            val js = """
                                if(window.MF && window.MF.LibraryRepository) {
                                    window.MF.LibraryRepository.getAll()
                                        .filter(r => r.email === '$email')
                                        .forEach(r => { window.MF.LibraryRepository.toggleVerified(r.id); });
                                }
                            """.trimIndent()
                            webView.evaluateJavascript(js, null)
                        }
                    }
                }
            }
        }
    }
}
