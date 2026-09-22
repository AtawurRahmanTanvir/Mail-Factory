package com.atawurrahmantanvir.mailfactory.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.SecureRandom

// ডেটা হোল্ড করার জন্য ডেটা ক্লাস
data class CredentialData(val email: String, val password: String)

object CredentialGeneratorEngine {
    
    // সাধারণ Random-এর বদলে হ্যাক-প্রুফ ক্রিপ্টোগ্রাফিক Random
    private val secureRandom = SecureRandom()

    // ক্যারেক্টার সেট (আপনার দেওয়া রুলস অনুযায়ী)
    private const val UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    private const val LOWERCASE = "abcdefghijklmnopqrstuvwxyz"
    private const val NUMBERS = "0123456789"
    private const val SPECIALS = "!@#\$%^&*()-_+=[]{}|\\:;\"',.?/`~<>"
    
    private const val ALL_PASSWORD_CHARS = UPPERCASE + LOWERCASE + NUMBERS + SPECIALS
    private const val EMAIL_CHARS = LOWERCASE + NUMBERS

    /**
     * একটিমাত্র ইমেইল ও পাসওয়ার্ড জেনারেট করার জন্য
     */
    fun generateSingle(rawName: String, emailLength: Int, passLength: Int): CredentialData {
        val email = generateEmail(rawName, emailLength)
        val password = generatePassword(passLength)
        return CredentialData(email, password)
    }

    /**
     * একসাথে অনেকগুলো ডেটা (Batch) ব্যাকগ্রাউন্ড থ্রেডে জেনারেট করার জন্য
     */
    suspend fun generateBatch(rawName: String, emailLength: Int, passLength: Int, count: Int): List<CredentialData> {
        // Dispatchers.Default ব্যবহার করা হয়েছে যেন ২০০ ডেটা জেনারেট করলেও UI ফ্রিজ না হয়
        return withContext(Dispatchers.Default) {
            List(count) { generateSingle(rawName, emailLength, passLength) }
        }
    }

    /**
     * গুগলের রুলস মেনে ইউনিক ইমেইল জেনারেটর
     */
    private fun generateEmail(rawName: String, targetLength: Int): String {
        val safeLength = targetLength.coerceAtLeast(6) // গুগলের নূন্যতম রুলস

        // ১. ইনপুট থেকে স্পেস এবং অবৈধ অক্ষর মুছে ফেলা
        val cleanBase = rawName.lowercase().replace(Regex("[^a-z0-9]"), "")
        
        // ২. ইউজারের দেওয়া লেন্থ অনুযায়ী নাম ট্রিম করা
        val base = if (cleanBase.length > safeLength) {
            cleanBase.substring(0, safeLength)
        } else {
            cleanBase
        }

        // ৩. বাকি ফাঁকা জায়গা র‍্যান্ডম a-z ও 0-9 দিয়ে পূরণ করা
        val remainingLength = safeLength - base.length
        val randomPart = buildString {
            repeat(remainingLength) {
                append(EMAIL_CHARS[secureRandom.nextInt(EMAIL_CHARS.length)])
            }
        }

        return "$base$randomPart@gmail.com"
    }

    /**
     * হাই-সিকিউরিটি 'পাগলাটে' পাসওয়ার্ড জেনারেটর
     */
    private fun generatePassword(length: Int): String {
        val safeLength = length.coerceAtLeast(4) // ৪টির নিচে হলে লজিক কাজ করবে না
        val passwordChars = mutableListOf<Char>()

        // ১. বাধ্যতামূলক ইনক্লুশন (প্রতিটি ক্যাটাগরি থেকে অন্তত ১টি)
        passwordChars.add(UPPERCASE[secureRandom.nextInt(UPPERCASE.length)])
        passwordChars.add(LOWERCASE[secureRandom.nextInt(LOWERCASE.length)])
        passwordChars.add(NUMBERS[secureRandom.nextInt(NUMBERS.length)])
        passwordChars.add(SPECIALS[secureRandom.nextInt(SPECIALS.length)])

        // ২. বাকি লেন্থ পুরো পুল থেকে রেন্ডমলি পূরণ করা
        repeat(safeLength - 4) {
            passwordChars.add(ALL_PASSWORD_CHARS[secureRandom.nextInt(ALL_PASSWORD_CHARS.length)])
        }

        // ৩. ডিপ ক্রিপ্টোগ্রাফিক শাফল (যাতে প্যাটার্ন ধরা না যায়)
        passwordChars.shuffle(secureRandom)

        return passwordChars.joinToString("")
    }
}