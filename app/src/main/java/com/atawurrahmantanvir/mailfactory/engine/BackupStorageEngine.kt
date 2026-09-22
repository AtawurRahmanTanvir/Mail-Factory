package com.atawurrahmantanvir.mailfactory.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

interface IBackupProvider {
    val providerName: String
    suspend fun isConnected(): Boolean
    suspend fun saveUnverified(email: String, password: String): Boolean
    suspend fun moveToVerified(email: String, password: String): Boolean
}

class LocalStorageProvider(private val backupDirectory: File) : IBackupProvider {

    override val providerName: String = "Phone Storage"
    
    private val unverifiedFile = File(backupDirectory, "Not_Verified.txt")
    private val verifiedFile = File(backupDirectory, "Verified.txt")

    init {
        // অ্যাপ চালুর সময় ফোল্ডার ও ফাইল না থাকলে অটোমেটিক বানিয়ে নেবে
        if (!backupDirectory.exists()) backupDirectory.mkdirs()
        if (!unverifiedFile.exists()) unverifiedFile.createNewFile()
        if (!verifiedFile.exists()) verifiedFile.createNewFile()
    }

    // লোকাল স্টোরেজ সবসময় কানেক্টেড থাকে
    override suspend fun isConnected(): Boolean = true

    override suspend fun saveUnverified(email: String, password: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val dataLine = "$email | $password\n"
                unverifiedFile.appendText(dataLine)
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    override suspend fun moveToVerified(email: String, password: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val dataLine = "$email | $password"
                
                // ১. Not_Verified ফাইল থেকে খুঁজে বের করে রিমুভ করা
                val unverifiedLines = unverifiedFile.readLines().toMutableList()
                val isRemoved = unverifiedLines.removeIf { it.trim() == dataLine }
                
                if (isRemoved) {
                    // মুছে ফেলার পর বাকি ডেটাগুলো আবার সেভ করা
                    unverifiedFile.writeText(unverifiedLines.joinToString("\n") + "\n")
                }

                // ২. Verified ফাইলে সুন্দর করে অ্যাড করা
                verifiedFile.appendText("$dataLine\n")
                true
            } catch (e: Exception) {
                false
            }
        }
    }
}