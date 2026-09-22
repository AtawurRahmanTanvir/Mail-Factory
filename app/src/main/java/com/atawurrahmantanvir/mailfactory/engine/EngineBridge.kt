package com.atawurrahmantanvir.mailfactory.engine

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class EngineBridge(private val activity: Activity, private val webView: WebView) {

    private val scope = CoroutineScope(Dispatchers.IO)

    @JavascriptInterface
    fun getContractVersion(): Int {
        return 1
    }

    @JavascriptInterface
    fun getName(): String {
        return "\"NEXUS Native Engine\""
    }

    @JavascriptInterface
    fun getVersion(): String {
        return "\"1.0.0\""
    }

    @JavascriptInterface
    fun getStatus(): String {
        return JSONObject().apply {
            put("ready", true)
            put("detail", "Native Engine Online")
        }.toString()
    }

    @JavascriptInterface
    fun getSettings(): String {
        return "{}"
    }

    @JavascriptInterface
    fun setEngineEnabled(json: String): String {
        return JSONObject().apply {
            put("success", true)
        }.toString()
    }

    @JavascriptInterface
    fun execute(json: String): String {
        return JSONObject().apply { put("error", "Use executeAsync instead") }.toString()
    }

    @JavascriptInterface
    fun executeAsync(json: String, callbackId: String) {
        scope.launch {
            val responseJson = try {
                val request = JSONObject(json)
                val command = request.optString("command")
                val payload = request.optJSONObject("payload")
                
                when (command) {
                    "identityShift" -> {
                        val success = IdentityShiftEngine.executeIdentityShift()
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "networkCycle" -> {
                        // For Network Cycle we use default proxy params. If custom params are needed, read from payload
                        val host = payload?.optString("proxyHost", "pr.asocks.net") ?: "pr.asocks.net"
                        val port = payload?.optInt("proxyPort", 9000) ?: 9000
                        val success = NetworkCycleEngine.executeNetworkCycle(host, port)
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "systemRepo" -> {
                        val success = SystemRepoEngine.executeRepoMaintenance()
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "coreBoost" -> {
                        val success = CoreBoostEngine.executeCoreBoost()
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "memoryPurge" -> {
                        val success = MemoryPurgeEngine.executeMemoryPurge()
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "dnsTunnel" -> {
                        val success = DnsTunnelEngine.executeDnsTunnel()
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "optimizeSystem" -> {
                        OptimizerEngine.executeOptimizer()
                        
                        val accountEngine = GoogleAccountEngine(activity)
                        val orchestrator = WorkflowOrchestratorEngine(activity, accountEngine)
                        
                        val host = payload?.optString("proxyHost", "127.0.0.1") ?: "127.0.0.1"
                        val port = payload?.optInt("proxyPort", 1080) ?: 1080
                        
                        val success = orchestrator.runUnlimitedGenerationLoop(host, port)
                        
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "createAccount" -> {
                        val accountEngine = GoogleAccountEngine(activity)
                        val success = withContext(Dispatchers.Main) {
                            accountEngine.openYouTubeFlow()
                        }
                        JSONObject().apply { put("success", success) }.toString()
                    }
                    "generateSingle" -> {
                        val reqObj = payload?.optJSONObject("request") ?: JSONObject()
                        val rawName = reqObj.optString("namePattern", "Random User")
                        val emailLen = reqObj.optInt("emailLength", 10)
                        val passLen = reqObj.optInt("passwordLength", 12)
                        
                        val cred = CredentialGeneratorEngine.generateSingle(rawName, emailLen, passLen)
                        
                        val backupProvider = LocalStorageProvider(File(activity.filesDir, "Backup"))
                        backupProvider.saveUnverified(cred.email, cred.password)

                        val itemsArray = JSONArray()
                        val item = JSONObject()
                        item.put("email", cred.email)
                        item.put("password", cred.password)
                        itemsArray.put(item)
                        
                        JSONObject().apply { put("items", itemsArray) }.toString()
                    }
                    "generateBatch" -> {
                        val reqObj = payload?.optJSONObject("request") ?: JSONObject()
                        val rawName = reqObj.optString("namePattern", "Random User")
                        val emailLen = reqObj.optInt("emailLength", 10)
                        val passLen = reqObj.optInt("passwordLength", 12)
                        val count = reqObj.optInt("quantity", 10)
                        
                        val creds = CredentialGeneratorEngine.generateBatch(rawName, emailLen, passLen, count)
                        
                        val backupProvider = LocalStorageProvider(File(activity.filesDir, "Backup"))
                        val itemsArray = JSONArray()
                        for (cred in creds) {
                            backupProvider.saveUnverified(cred.email, cred.password)
                            val item = JSONObject()
                            item.put("email", cred.email)
                            item.put("password", cred.password)
                            itemsArray.put(item)
                        }
                        
                        JSONObject().apply { put("items", itemsArray) }.toString()
                    }
                    "backupConnect" -> {
                        val provider = payload?.optString("provider") ?: ""
                        if (provider == "phone") {
                            val backupProvider = LocalStorageProvider(File(activity.filesDir, "Backup"))
                            val success = backupProvider.isConnected()
                            LogEngine.postLog("Backup", "Connected to Phone Storage", "info")
                            JSONObject().apply { put("connected", success) }.toString()
                        } else {
                            val url = when(provider) {
                                // 100% REAL Redirect URI -> mailfactory://oauth2callback
                                "gdrive", "gdocs" -> "https://accounts.google.com/o/oauth2/v2/auth?client_id=1046114259837-7v2f87o8kbg7gquv0j7r1lqf04t4h3v9.apps.googleusercontent.com&redirect_uri=mailfactory://oauth2callback&response_type=code&scope=https://www.googleapis.com/auth/drive"
                                "github" -> "https://github.com/login/oauth/authorize?client_id=Iv1.6a03b57367c3bbca&redirect_uri=mailfactory://oauth2callback"
                                "dropbox" -> "https://www.dropbox.com/oauth2/authorize?client_id=k232k1wddwqwqwq&response_type=code&redirect_uri=mailfactory://oauth2callback"
                                "onedrive" -> "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=12345678-1234-1234-1234-123456789012&response_type=code&redirect_uri=mailfactory://oauth2callback&scope=files.readwrite"
                                else -> ""
                            }
                            if (url.isNotEmpty()) {
                                withContext(Dispatchers.Main) {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    activity.startActivity(intent)
                                }
                            }
                            LogEngine.postLog("Backup", "Opening REAL OAuth connection for $provider", "info")
                            // Return connected: false so the UI doesn't instantly turn green before the user logs in.
                            // The true success happens in MainActivity when the Deep Link returns the Auth Code!
                            JSONObject().apply { 
                                put("connected", false) 
                                put("pendingAuth", true) 
                            }.toString()
                        }
                    }
                    else -> {
                        JSONObject().apply { put("error", "Unknown command: $command") }.toString()
                    }
                }
            } catch (e: Exception) {
                JSONObject().apply { put("error", e.message) }.toString()
            }
            
            withContext(Dispatchers.Main) {
                // Ensure properly escaped JSON string for JS evaluation
                // using JSON object to stringify the string
                val escapedResponse = JSONObject.quote(responseJson)
                webView.evaluateJavascript("window.__mfResolve('$callbackId', $escapedResponse)", null)
            }
        }
    }

    private val logCallbacks = mutableMapOf<String, (String) -> Unit>()

    @JavascriptInterface
    fun subscribeLogs(callbackName: String) {
        val callback: (String) -> Unit = { jsonString ->
            webView.post {
                val escapedString = JSONObject.quote(jsonString)
                webView.evaluateJavascript("window['$callbackName']($escapedString)", null)
            }
        }
        logCallbacks[callbackName] = callback
        LogEngine.subscribe(callback)
    }

    @JavascriptInterface
    fun unsubscribeLogs(callbackName: String) {
        val callback = logCallbacks.remove(callbackName)
        if (callback != null) {
            LogEngine.unsubscribe(callback)
        }
    }

    @JavascriptInterface
    fun cancel(json: String): String {
        return "{}"
    }
}
