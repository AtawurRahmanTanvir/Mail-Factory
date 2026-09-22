package com.atawurrahmantanvir.mailfactory.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

object RootVerificationEngine {

    /**
     * নির্দিষ্ট একটি জেনারেটেড ইমেইল সিস্টেমে সাকসেসফুলি অ্যাড হয়েছে কিনা তা চেক করবে।
     * 
     * @param targetEmail যে ইমেইলটা চেক করতে হবে (যেমন: atawur7x9p@gmail.com)
     * @return ইমেইলটি অ্যাকাউন্টে পাওয়া গেলে true, না হলে false
     */
    suspend fun verifySpecificAccountAdded(targetEmail: String): Boolean {
        return withContext(Dispatchers.IO) {
            var isFound = false
            var process: Process? = null

            try {
                // রুট (su) ব্যবহার করে সিস্টেমের সব অ্যাকাউন্টের লিস্ট ডাম্প করা
                process = Runtime.getRuntime().exec(arrayOf("su", "-c", "dumpsys account"))
                
                val reader = BufferedReader(InputStreamReader(process.inputStream))
                var line: String?

                // আউটপুটের প্রতিটি লাইন রিড করা
                while (reader.readLine().also { line = it } != null) {
                    // dumpsys account এর আউটপুটে সাধারণত থাকে: Account {name=example@gmail.com, type=com.google}
                    // আমরা শুধু আমাদের টার্গেট ইমেইলটা এই লিস্টে আছে কিনা তা খুঁজছি
                    if (line?.contains(targetEmail, ignoreCase = true) == true) {
                        isFound = true
                        break // ইমেইল পাওয়া গেলে লুপ আর চালানোর দরকার নেই
                    }
                }
                process.waitFor()

            } catch (e: Exception) {
                e.printStackTrace()
                // রুট পারমিশন না থাকলে বা এরর হলে ফলস রিটার্ন করবে
                isFound = false
            } finally {
                process?.destroy()
            }

            return@withContext isFound
        }
    }
}