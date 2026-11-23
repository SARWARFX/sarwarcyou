package cyou.sarwar.vault.utils

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import cyou.sarwar.vault.data.MediaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object CacheManager {
    private const val FILE_PROVIDER_AUTHORITY = "cyou.sarwar.vault.fileprovider"

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private fun getMediaCacheDir(context: Context): File {
        val dir = File(context.cacheDir, "vault_media")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun isMediaCached(context: Context, item: MediaItem): Boolean {
        val file = getCachedFile(context, item)
        return file.exists() && file.length() > 0
    }

    fun getCachedFile(context: Context, item: MediaItem): File {
        val sanitizedName = item.path.replace('/', '_').replace('\\', '_')
        return File(getMediaCacheDir(context), sanitizedName)
    }

    fun getContentUriForFile(context: Context, file: File): Uri {
        return FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file)
    }

    suspend fun getOrDownloadMediaFile(
        context: Context,
        item: MediaItem,
        onProgress: ((Float) -> Unit)? = null
    ): Result<File> = withContext(Dispatchers.IO) {
        val targetFile = getCachedFile(context, item)
        if (targetFile.exists() && targetFile.length() > 0) {
            onProgress?.invoke(1f)
            return@withContext Result.success(targetFile)
        }

        try {
            val request = Request.Builder()
                .url(item.url)
                .header("User-Agent", "SarwarVault-Android/1.0")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP error ${response.code} downloading media"))
            }

            val body = response.body ?: return@withContext Result.failure(Exception("Empty response body"))
            val contentLength = body.contentLength()

            val tempFile = File(getMediaCacheDir(context), "${targetFile.name}.tmp")
            body.byteStream().use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(8 * 1024)
                    var totalRead = 0L
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        totalRead += read
                        if (contentLength > 0 && onProgress != null) {
                            onProgress(totalRead.toFloat() / contentLength.toFloat())
                        }
                    }
                    output.flush()
                }
            }

            if (tempFile.renameTo(targetFile)) {
                Result.success(targetFile)
            } else {
                tempFile.copyTo(targetFile, overwrite = true)
                tempFile.delete()
                Result.success(targetFile)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
