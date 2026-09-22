package com.atawurrahmantanvir.mailfactory.engine

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object CryptoVaultEngine {

    private const val KEY_ALIAS = "MailFactory_Vault_Key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_LENGTH = 12
    private const val TAG_LENGTH = 128

    init {
        setupMasterKey()
    }

    /**
     * অ্যাপ চালুর সময় চেক করবে Keystore-এ চাবি আছে কিনা। না থাকলে নতুন হার্ডওয়্যার-লেভেল চাবি বানাবে।
     */
    private fun setupMasterKey() {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            val keySpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256) // AES-256 (মিলিটারি গ্রেড সিকিউরিটি)
                .build()

            keyGenerator.init(keySpec)
            keyGenerator.generateKey()
        }
    }

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return keyStore.getKey(KEY_ALIAS, null) as SecretKey
    }

    /**
     * প্লেইন টেক্সট (যেমন পাসওয়ার্ড) ইনপুট নিয়ে সেটিকে আনব্রেকেবল স্ট্রিংয়ে রূপান্তর করবে।
     */
    fun encryptData(plainText: String): String {
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getSecretKey())
            
            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
            
            // IV এবং এনক্রিপ্টেড ডেটা একসাথে Base64 এ রূপান্তর করে রিটার্ন করা হচ্ছে
            val combinedData = iv + encryptedBytes
            Base64.encodeToString(combinedData, Base64.DEFAULT)
        } catch (e: Exception) {
            e.printStackTrace()
            "ENCRYPTION_FAILED"
        }
    }

    /**
     * এনক্রিপ্টেড স্ট্রিং ইনপুট নিয়ে আসল ডেটা বা পাসওয়ার্ড বের করে আনবে।
     */
    fun decryptData(encryptedBase64: String): String {
        return try {
            val combinedData = Base64.decode(encryptedBase64, Base64.DEFAULT)
            
            // IV এবং আসল এনক্রিপ্টেড ডেটা আলাদা করা
            val iv = combinedData.copyOfRange(0, IV_LENGTH)
            val encryptedBytes = combinedData.copyOfRange(IV_LENGTH, combinedData.size)
            
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), spec)
            
            val decryptedBytes = cipher.doFinal(encryptedBytes)
            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            e.printStackTrace()
            "DECRYPTION_FAILED"
        }
    }
}