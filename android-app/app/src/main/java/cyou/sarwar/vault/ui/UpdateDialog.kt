package cyou.sarwar.vault.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import cyou.sarwar.vault.data.AppUpdateInfo
import cyou.sarwar.vault.network.UpdateChecker
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun UpdateDialog(
    onDismissRequest: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isChecking by remember { mutableStateOf(true) }
    var updateInfo by remember { mutableStateOf<AppUpdateInfo?>(null) }
    var isDownloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableFloatStateOf(0f) }
    var downloadedBytes by remember { mutableLongStateOf(0L) }
    var totalBytes by remember { mutableLongStateOf(0L) }
    var errorText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val result = UpdateChecker.checkForUpdate(context)
        isChecking = false
        result.fold(
            onSuccess = { info -> updateInfo = info },
            onFailure = { err -> errorText = err.localizedMessage ?: "Failed to check update" }
        )
    }

    Dialog(onDismissRequest = {
        if (!isDownloading) onDismissRequest()
    }) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            color = Color(0xFF0A0A0A),
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .border(1.dp, Color(0xFF222222), RoundedCornerShape(12.dp))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.SystemUpdate,
                            contentDescription = null,
                            tint = Color(0xFF00F2FE),
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "APP UPDATER",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }

                    if (!isDownloading) {
                        IconButton(
                            onClick = onDismissRequest,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close",
                                tint = Color.Gray
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                if (isChecking) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        color = Color(0xFF00F2FE),
                        strokeWidth = 3.dp
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "Checking GitHub releases...",
                        color = Color(0xFFAAAAAA),
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                } else if (errorText != null) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = Color(0xFFFF4444),
                        modifier = Modifier.size(40.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = errorText ?: "",
                        color = Color(0xFFFF6666),
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                } else if (updateInfo != null) {
                    val info = updateInfo!!
                    if (info.isUpdateAvailable) {
                        Icon(
                            imageVector = Icons.Default.DownloadForOffline,
                            contentDescription = null,
                            tint = Color(0xFF00F2FE),
                            modifier = Modifier.size(44.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "NEW VERSION AVAILABLE",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "v${info.currentVersion}  ->  v${info.latestVersion}",
                            color = Color(0xFF00F2FE),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace
                        )

                        if (isDownloading) {
                            Spacer(modifier = Modifier.height(16.dp))
                            LinearProgressIndicator(
                                progress = { downloadProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp),
                                color = Color(0xFF00F2FE),
                                trackColor = Color(0xFF222222)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "${formatMb(downloadedBytes)} / ${formatMb(totalBytes)} (${(downloadProgress * 100).toInt()}%)",
                                color = Color(0xFF888888),
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                isDownloading = true
                                scope.launch {
                                    val res = UpdateChecker.downloadAndInstallApk(
                                        context = context,
                                        downloadUrl = info.downloadUrl,
                                        onProgress = { fraction, down, tot ->
                                            downloadProgress = fraction
                                            downloadedBytes = down
                                            totalBytes = tot
                                        }
                                    )
                                    isDownloading = false
                                    res.fold(
                                        onSuccess = {
                                            onDismissRequest()
                                        },
                                        onFailure = { err ->
                                            errorText = err.localizedMessage ?: "Download failed"
                                        }
                                    )
                                }
                            },
                            enabled = !isDownloading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00F2FE),
                                contentColor = Color.Black
                            )
                        ) {
                            Text(
                                text = if (isDownloading) "DOWNLOADING UPDATE..." else "ONE-CLICK UPDATE NOW",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    } else {
                        // Up to date!
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF00FF66),
                            modifier = Modifier.size(44.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "APP IS UP TO DATE",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Installed Version: v${info.currentVersion}",
                            color = Color(0xFF888888),
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        OutlinedButton(
                            onClick = onDismissRequest,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF333333)),
                            modifier = Modifier.fillMaxWidth().height(40.dp)
                        ) {
                            Text(text = "DONE", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

private fun formatMb(bytes: Long): String {
    if (bytes <= 0) return "0.0 MB"
    val mb = bytes / (1024.0 * 1024.0)
    return String.format(Locale.US, "%.1f MB", mb)
}
