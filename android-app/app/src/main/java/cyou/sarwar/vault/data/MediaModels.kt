package cyou.sarwar.vault.data

data class MediaItem(
    val id: String,
    val name: String,
    val path: String,
    val url: String,
    val thumbnailUrl: String? = null,
    val size: Long = 0L,
    val isVideo: Boolean = false
)

data class SubFolder(
    val name: String,
    val path: String,
    val items: List<MediaItem> = emptyList(),
    val isExpanded: Boolean = true
)

data class MainFolder(
    val id: String,
    val name: String,
    val displayName: String,
    val iconName: String = "folder",
    val subFolders: List<SubFolder> = emptyList(),
    val directItems: List<MediaItem> = emptyList(),
    val isExpanded: Boolean = true
)

data class AppUpdateInfo(
    val isUpdateAvailable: Boolean,
    val currentVersion: String,
    val latestVersion: String,
    val downloadUrl: String,
    val releaseNotes: String = ""
)

data class UploadProgress(
    val bytesWritten: Long,
    val totalBytes: Long,
    val progressFraction: Float,
    val speedBytesPerSec: Double,
    val etaSeconds: Long,
    val isComplete: Boolean = false,
    val isVerified: Boolean = false,
    val error: String? = null
)
