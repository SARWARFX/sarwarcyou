package cyou.sarwar.vault.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class MediaRepository(private val context: Context) {

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    private val localCatalogFile by lazy {
        File(context.filesDir, "cached_website_catalog.json")
    }

    companion object {
        private const val WEBSITE_CATALOG_URL = "https://media.sarwar.cyou/media.json"
        private const val BACKUP_WEBSITE_CATALOG_URL = "https://sarwar.cyou/media.json"
    }

    suspend fun getFolders(forceRefresh: Boolean = false): List<MainFolder> = withContext(Dispatchers.IO) {
        // 1. If not forcing refresh and cached file exists, load immediately
        if (!forceRefresh && localCatalogFile.exists() && localCatalogFile.length() > 0) {
            try {
                val cachedJson = localCatalogFile.readText()
                val parsed = parseWebsiteCatalogJson(JSONObject(cachedJson))
                if (parsed.isNotEmpty()) return@withContext parsed
            } catch (e: Exception) {
                // Ignore and proceed to network fetch
            }
        }

        // 2. Fetch fresh catalog from website proxy
        for (url in listOf(WEBSITE_CATALOG_URL, BACKUP_WEBSITE_CATALOG_URL)) {
            try {
                val request = Request.Builder()
                    .url(url)
                    .header("User-Agent", "SarwarVault-Android/1.0")
                    .build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val jsonStr = response.body?.string().orEmpty()
                    if (jsonStr.isNotBlank()) {
                        localCatalogFile.writeText(jsonStr)
                        val parsed = parseWebsiteCatalogJson(JSONObject(jsonStr))
                        if (parsed.isNotEmpty()) return@withContext parsed
                    }
                }
            } catch (e: Exception) {
                // Try next endpoint
            }
        }

        // 3. If network failed, check local cached file
        if (localCatalogFile.exists() && localCatalogFile.length() > 0) {
            try {
                val cachedJson = localCatalogFile.readText()
                val parsed = parseWebsiteCatalogJson(JSONObject(cachedJson))
                if (parsed.isNotEmpty()) return@withContext parsed
            } catch (e: Exception) {
                // Fall through to asset fallback
            }
        }

        // 4. Bundled asset fallback (100% offline guarantee)
        try {
            context.assets.open("media_fallback.json").use { stream ->
                val jsonStr = stream.bufferedReader().use { it.readText() }
                return@withContext parseWebsiteCatalogJson(JSONObject(jsonStr))
            }
        } catch (e: Exception) {
            // Return empty
        }

        emptyList()
    }

    private fun parseWebsiteCatalogJson(root: JSONObject): List<MainFolder> {
        val result = mutableListOf<MainFolder>()

        val majorConfigs = listOf(
            Triple("Photographs", "images", false),
            Triple("Shorts", "shorts", true),
            Triple("Video Clips", "clips", true),
            Triple("Bandhobi", "bandhobi", false)
        )

        for ((majorTitle, jsonKey, defaultIsVideo) in majorConfigs) {
            val jsonArray = root.optJSONArray(jsonKey) ?: JSONArray()
            val subFoldersMap = mutableMapOf<String, MutableList<MediaItem>>()
            val directItems = mutableListOf<MediaItem>()

            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.optJSONObject(i) ?: continue
                val name = obj.optString("name", "")
                val path = obj.optString("path", "")
                val url = obj.optString("url", "")
                val thumbnail = obj.optString("thumbnail", url)
                val size = obj.optLong("size", 0L)

                val lower = name.lowercase()
                val isVideo = defaultIsVideo || lower.endsWith(".mp4") || lower.endsWith(".webm") ||
                        lower.endsWith(".mov") || lower.endsWith(".mkv")

                val item = MediaItem(
                    id = path.ifEmpty { "$majorTitle/$name" },
                    name = name,
                    path = path,
                    url = url,
                    thumbnailUrl = thumbnail,
                    size = size,
                    isVideo = isVideo
                )

                val parts = path.split("/")
                if (parts.size > 2) {
                    val subName = parts[1]
                    subFoldersMap.getOrPut(subName) { mutableListOf() }.add(item)
                } else if (parts.size == 2) {
                    val subName = parts[0]
                    if (subName.equals(majorTitle, ignoreCase = true) || subName.equals("bandhobiz", ignoreCase = true)) {
                        directItems.add(item)
                    } else {
                        subFoldersMap.getOrPut(subName) { mutableListOf() }.add(item)
                    }
                } else {
                    directItems.add(item)
                }
            }

            val subFolders = subFoldersMap.map { (subName, items) ->
                SubFolder(
                    name = subName,
                    path = "$majorTitle/$subName",
                    items = items.sortedBy { it.name },
                    isExpanded = false
                )
            }.sortedBy { it.name }

            result.add(
                MainFolder(
                    id = majorTitle,
                    name = majorTitle,
                    displayName = majorTitle,
                    iconName = when (majorTitle) {
                        "Photographs" -> "photo"
                        "Shorts" -> "play_arrow"
                        "Video Clips" -> "video_library"
                        else -> "favorite"
                    },
                    subFolders = subFolders,
                    directItems = directItems.sortedBy { it.name },
                    isExpanded = false
                )
            )
        }

        return result
    }
}
