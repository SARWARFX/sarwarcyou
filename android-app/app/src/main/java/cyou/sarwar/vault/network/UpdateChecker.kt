package cyou.sarwar.vault.network

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import cyou.sarwar.vault.data.AppUpdateInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

object UpdateChecker {
    private const val GITHUB_LATEST_RELEASE_URL =
        "https://api.github.com/repos/SARWARFX/sarwarcyou/releases/latest"
    private const val FILE_PROVIDER_AUTHORITY = "cyou.sarwar.vault.fileprovider"

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    fun getCurrentVersion(context: Context): String {
        return try {
            val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    suspend fun checkForUpdate(context: Context): Result<AppUpdateInfo> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url(GITHUB_LATEST_RELEASE_URL)
                .header("Accept", "application/vnd.github.v3+json")
                .header("User-Agent", "SarwarVault-Android")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP error ${response.code} checking for updates"))
            }

            val body = response.body?.string().orEmpty()
            val json = JSONObject(body)
            val tagName = json.optString("tag_name", "").trim()
            val latestVersion = tagName.removePrefix("v").trim()
            val currentVersion = getCurrentVersion(context)

            val assets = json.optJSONArray("assets")
            var downloadUrl = ""

            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val asset = assets.optJSONObject(i) ?: continue
                    val name = asset.optString("name", "")
                    if (name.endsWith(".apk", ignoreCase = true)) {
                        downloadUrl = asset.optString("browser_download_url", "")
                        if (name.contains("StreamVault", ignoreCase = true) || name.contains("SARWARCYOU", ignoreCase = true)) {
                            break
                        }
                    }
                }
            }

            val releaseNotes = json.optString("body", "")

            val isUpdateAvailable = isVersionNewer(latestVersion, currentVersion) && downloadUrl.isNotBlank()

            Result.success(
                AppUpdateInfo(
                    isUpdateAvailable = isUpdateAvailable,
                    currentVersion = currentVersion,
                    latestVersion = latestVersion.ifEmpty { currentVersion },
                    downloadUrl = downloadUrl,
                    releaseNotes = releaseNotes
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun isVersionNewer(latest: String, current: String): Boolean {
        if (latest.isBlank()) return false
        val latestParts = latest.split(".").mapNotNull { it.toIntOrNull() }
        val currentParts = current.split(".").mapNotNull { it.toIntOrNull() }

        val maxLength = maxOf(latestParts.size, currentParts.size)
        for (i in 0 until maxLength) {
            val l = latestParts.getOrElse(i) { 0 }
            val c = currentParts.getOrElse(i) { 0 }
            if (l > c) return true
            if (l < c) return false
        }
        return false
    }

    suspend fun downloadAndInstallApk(
        context: Context,
        downloadUrl: String,
        onProgress: (Float, Long, Long) -> Unit
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val updateApk = File(context.cacheDir, "update.apk")
            if (updateApk.exists()) {
                updateApk.delete()
            }

            val request = Request.Builder()
                .url(downloadUrl)
                .header("User-Agent", "SarwarVault-Android")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("Failed to download APK: HTTP ${response.code}"))
            }

            val body = response.body ?: return@withContext Result.failure(Exception("Empty body response"))
            val totalBytes = body.contentLength()

            val tempFile = File(context.cacheDir, "update.apk.tmp")
            body.byteStream().use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var downloaded = 0L
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        downloaded += read
                        val fraction = if (totalBytes > 0) downloaded.toFloat() / totalBytes.toFloat() else 0f
                        onProgress(fraction, downloaded, totalBytes)
                    }
                    output.flush()
                }
            }

            if (tempFile.renameTo(updateApk)) {
                triggerPackageInstaller(context, updateApk)
                Result.success(Unit)
            } else {
                tempFile.copyTo(updateApk, overwrite = true)
                tempFile.delete()
                triggerPackageInstaller(context, updateApk)
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun triggerPackageInstaller(context: Context, apkFile: File) {
        val apkUri: Uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, apkFile)
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
    }

    fun cleanupPendingUpdate(context: Context) {
        try {
            val updateApk = File(context.cacheDir, "update.apk")
            if (updateApk.exists()) {
                updateApk.delete()
            }
            val tmp = File(context.cacheDir, "update.apk.tmp")
            if (tmp.exists()) {
                tmp.delete()
            }
        } catch (ignored: Exception) {}
    }
}
