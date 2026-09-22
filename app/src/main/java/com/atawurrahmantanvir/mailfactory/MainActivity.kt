package com.atawurrahmantanvir.mailfactory

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.atawurrahmantanvir.mailfactory.engine.AutoVerifyEngine
import com.atawurrahmantanvir.mailfactory.engine.EngineBridge
import com.atawurrahmantanvir.mailfactory.engine.LogEngine

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        LogEngine.startPeriodicSilentLogs()

        // স্ট্যাটাস বার এবং নেভিগেশন বার পিওর ব্ল্যাক (কালো) করা হলো (আর ছাই কালার দেখাবে না)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        // Notch cutout handling
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                databaseEnabled = true

                // One Touch-এর স্পিড বাড়ানোর জন্য ম্যাক্সিমাম পারফরম্যান্স সেটিং
                cacheMode = WebSettings.LOAD_NO_CACHE
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false

                @Suppress("DEPRECATION")
                allowFileAccessFromFileURLs = true
                @Suppress("DEPRECATION")
                allowUniversalAccessFromFileURLs = true
            }

            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            addJavascriptInterface(EngineBridge(this@MainActivity, this), "MailFactoryEngine")

            if (savedInstanceState != null) {
                restoreState(savedInstanceState)
            } else {
                loadUrl("file:///android_asset/index.html")
            }
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        AutoVerifyEngine.checkAndVerifyAccounts(webView)
        
        // 100% Real OAuth Interceptor
        val uri = intent?.data
        if (uri != null && uri.scheme == "mailfactory" && uri.host == "oauth2callback") {
            val authCode = uri.getQueryParameter("code")
            if (authCode != null) {
                LogEngine.postLog("OAuth2", "Received Auth Code: $authCode")
                // Notify JS that Backup Connection was successful
                webView.evaluateJavascript("if(window.MF && window.MF.toast) { window.MF.toast.show('Successfully Connected to Cloud!'); }", null)
                // Clear intent to avoid processing it multiple times
                intent.data = null
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }
}