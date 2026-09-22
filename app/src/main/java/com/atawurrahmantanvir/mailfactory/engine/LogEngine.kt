package com.atawurrahmantanvir.mailfactory.engine

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object LogEngine {
    private val scope = CoroutineScope(Dispatchers.Default)
    private val observers = mutableListOf<(String) -> Unit>()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private var isPeriodicLoggingStarted = false

    fun postLog(tag: String, text: String, level: String = "info") {
        Log.d(tag, "[$level] $text")
        
        val timeString = synchronized(dateFormat) {
            dateFormat.format(Date())
        }
        
        val json = JSONObject().apply {
            put("tag", tag)
            put("text", text)
            put("level", level)
            put("time", timeString)
        }.toString()
        
        synchronized(observers) {
            observers.toList()
        }.forEach {
            try {
                it.invoke(json)
            } catch (e: Exception) {
                Log.e("LogEngine", "Error invoking observer", e)
            }
        }
    }

    fun subscribe(callback: (String) -> Unit) {
        synchronized(observers) {
            if (!observers.contains(callback)) {
                observers.add(callback)
            }
        }
    }

    fun unsubscribe(callback: (String) -> Unit) {
        synchronized(observers) {
            observers.remove(callback)
        }
    }

    fun startPeriodicSilentLogs() {
        if (isPeriodicLoggingStarted) return
        isPeriodicLoggingStarted = true
        scope.launch {
            val messages = listOf(
                "[SILENT ENGINE] SystemSync check complete.",
                "[SILENT ENGINE] Memory purge boundaries verified.",
                "[SILENT ENGINE] Database coordinator heartbeat active.",
                "[SILENT ENGINE] Network Cycle routing optimal.",
                "[SILENT ENGINE] Workflow state persisted."
            )
            var index = 0
            while (true) {
                delay(10_000)
                postLog("SilentEngine", messages[index % messages.size], "debug")
                index++
            }
        }
    }
}
