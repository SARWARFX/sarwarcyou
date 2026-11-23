package cyou.sarwar.vault.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class MediaRepository(private val context: Context) {

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    private val localCatalogFile by lazy {
        File(context.filesDir, "cached_catalog.json")
    }

    companion object {
        private const val HF_TREE_URL =
            "https://huggingface.co/api/datasets/SARWARFX/stream-vault/tree/main?recursive=true"
        private const val HF_RESOLVE_BASE =
            "https://huggingface.co/datasets/SARWARFX/stream-vault/resolve/main/"
        private const val HF_THUMB_BASE =
            "https://sarwar.cyou/thumbs/"

        private val VIDEO_EXTENSIONS = setOf("mp4", "mkv", "webm", "mov", "avi", "3gp", "ts")
        private val PHOTO_EXTENSIONS = setOf("jpg", "jpeg", "png", "webp", "gif", "bmp", "heic")

        private val MAIN_FOLDER_KEYS = listOf(
            Triple("Photographs", "Photographs", "photo"),
            Triple("Shorts", "Shorts", "play_arrow"),
            Triple("Video Clips", "Video Clips", "video_library"),
            Triple("bandhobiz", "Bandhobi", "favorite")
        )
    }

    suspend fun getFolders(forceRefresh: Boolean = false): List<MainFolder> = withContext(Dispatchers.IO) {
        if (!forceRefresh && localCatalogFile.exists() && localCatalogFile.length() > 0) {
            try {
                val cachedJson = localCatalogFile.readText()
                val parsed = parseTreeJson(JSONArray(cachedJson))
                if (parsed.isNotEmpty()) return@withContext parsed
            } catch (e: Exception) {
                // Ignore and fetch fresh
            }
        }

        try {
            val request = Request.Builder()
                .url(HF_TREE_URL)
                .header("User-Agent", "SarwarVault-Android/1.0")
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val jsonStr = response.body?.string().orEmpty()
                if (jsonStr.isNotBlank()) {
                    localCatalogFile.writeText(jsonStr)
                    return@withContext parseTreeJson(JSONArray(jsonStr))
                }
            }
        } catch (e: Exception) {
            // Network failure: try reading local cached catalog if exists
            if (localCatalogFile.exists()) {
                val cachedJson = localCatalogFile.readText()
                return@withContext parseTreeJson(JSONArray(cachedJson))
            }
        }

        emptyList()
    }

    private fun parseTreeJson(array: JSONArray): List<MainFolder> {
        val folderItemsMap = mutableMapOf<String, MutableList<MediaItem>>()

        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val type = obj.optString("type")
            if (type != "file") continue

            val path = obj.optString("path", "")
            if (path.isEmpty() || path.startsWith(".") || path.contains("/.")) continue

            val ext = path.substringAfterLast('.', "").lowercase()
            val isVideo = ext in VIDEO_EXTENSIONS
            val isPhoto = ext in PHOTO_EXTENSIONS

            if (!isVideo && !isPhoto) continue

            val size = obj.optLong("size", 0L)
            val name = path.substringAfterLast('/')
            val encodedPath = path.split("/").joinToString("/") { segment ->
                URLEncoder.encode(segment, "UTF-8").replace("+", "%20")
            }
            val resolveUrl = "$HF_RESOLVE_BASE$encodedPath"

            val item = MediaItem(
                id = path,
                name = name,
                path = path,
                url = resolveUrl,
                thumbnailUrl = "$HF_THUMB_BASE${encodedPath.substringBeforeLast('.')}.webp",
                size = size,
                isVideo = isVideo
            )

            // Determine top folder
            val segments = path.split("/")
            if (segments.isNotEmpty()) {
                val topFolder = segments[0]
                folderItemsMap.getOrPut(topFolder) { mutableListOf() }.add(item)
            }
        }

        val mainFolders = mutableListOf<MainFolder>()

        for ((key, displayName, icon) in MAIN_FOLDER_KEYS) {
            val items = folderItemsMap[key] ?: mutableListOf()
            val subFoldersMap = mutableMapOf<String, MutableList<MediaItem>>()
            val directItems = mutableListOf<MediaItem>()

            for (item in items) {
                val segments = item.path.split("/")
                if (segments.size > 2) {
                    // Subfolder: segments[1]
                    val subName = segments[1]
                    val subPath = "$key/$subName"
                    subFoldersMap.getOrPut(subName) { mutableListOf() }.add(item)
                } else {
                    directItems.add(item)
                }
            }

            val subFolders = subFoldersMap.map { (subName, subItems) ->
                SubFolder(
                    name = subName,
                    path = "$key/$subName",
                    items = subItems.sortedBy { it.name },
                    isExpanded = true // Expanded by default as requested!
                )
            }.sortedBy { it.name }

            mainFolders.add(
                MainFolder(
                    id = key,
                    name = key,
                    displayName = displayName,
                    iconName = icon,
                    subFolders = subFolders,
                    directItems = directItems.sortedBy { it.name },
                    isExpanded = true // Expanded by default as requested!
                )
            )
        }

        return mainFolders
    }
}
