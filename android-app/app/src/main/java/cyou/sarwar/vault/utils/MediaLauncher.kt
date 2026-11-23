package cyou.sarwar.vault.utils

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import cyou.sarwar.vault.data.MediaItem
import java.io.File

object MediaLauncher {

    fun launchMedia(context: Context, file: File, isVideo: Boolean) {
        val contentUri: Uri = CacheManager.getContentUriForFile(context, file)
        val mimeType = if (isVideo) "video/*" else "image/*"

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(contentUri, mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        // Specifically attempt Samsung Gallery or Samsung Video Player first if available,
        // otherwise let the system chooser handle it cleanly.
        val preferredPackages = if (isVideo) {
            listOf(
                "com.samsung.android.video",        // Samsung Video Player
                "com.sec.android.app.videoplayer",  // Older Samsung Video
                "com.google.android.apps.photos"    // Google Photos fallback
            )
        } else {
            listOf(
                "com.sec.android.gallery3d",        // Samsung Gallery
                "com.google.android.apps.photos"    // Google Photos fallback
            )
        }

        var launched = false
        val packageManager = context.packageManager

        for (pkg in preferredPackages) {
            val targetIntent = Intent(intent).apply { setPackage(pkg) }
            val resolveInfo = packageManager.resolveActivity(targetIntent, 0)
            if (resolveInfo != null) {
                try {
                    context.startActivity(targetIntent)
                    launched = true
                    break
                } catch (ignored: Exception) {}
            }
        }

        if (!launched) {
            try {
                // Remove package restriction and open with system default chooser
                intent.setPackage(null)
                val chooser = Intent.createChooser(intent, if (isVideo) "Play Video" else "View Photo").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(chooser)
            } catch (e: ActivityNotFoundException) {
                Toast.makeText(context, "No app available to open this file", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
