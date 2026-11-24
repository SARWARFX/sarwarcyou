package cyou.sarwar.vault.ui

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import cyou.sarwar.vault.data.UploadProgress
import cyou.sarwar.vault.network.HuggingFaceUploader
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadDialog(
    availablePaths: List<String>,
    initialPath: String? = null,
    onDismissRequest: () -> Unit,
    onUploadSuccess: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uploader = remember { HuggingFaceUploader() }

    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedFileName by remember { mutableStateOf("") }
    var selectedFileSize by remember { mutableLongStateOf(0L) }

    val safePaths = if (availablePaths.isNotEmpty()) availablePaths else listOf(
        "Photographs/Older",
        "Photographs/Favorite",
        "Photographs/2025",
        "Photographs/2026",
        "Photographs/2027",
        "Shorts/Older",
        "Shorts/2027",
        "Video Clips/Favorite",
        "Video Clips/Older",
        "Video Clips/2026",
        "Video Clips/2025",
        "Video Clips/2027",
        "Bandhobi/Photographs",
        "Bandhobi/Shorts",
        "Bandhobi/Video Clips"
    )

    var selectedPath by remember {
        mutableStateOf(if (initialPath != null && safePaths.contains(initialPath)) initialPath else safePaths.first())
    }
    var dropdownExpanded by remember { mutableStateOf(false) }

    var isUploading by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf<UploadProgress?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedUri = uri
            val (name, size) = queryFileInfo(context, uri)
            selectedFileName = name
            selectedFileSize = size
        }
    }

    Dialog(onDismissRequest = {
        if (!isUploading) onDismissRequest()
    }) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            shape = RoundedCornerShape(10.dp),
            color = Color(0xFF090909),
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .border(1.dp, Color(0xFF222222), RoundedCornerShape(10.dp))
                    .padding(18.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = null,
                            tint = Color(0xFF00F2FE),
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "VAULT UPLOAD",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }

                    if (!isUploading) {
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

                Spacer(modifier = Modifier.height(14.dp))

                // Strict Destination Policy Notice
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF121212), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF222222), RoundedCornerShape(4.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "Destination policy: Direct upload to existing subfolders only.",
                        color = Color(0xFF999999),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Strict Destination Subfolder Selector (No freeform text box)
                Text(
                    text = "DESTINATION SUBFOLDER",
                    color = Color(0xFF777777),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(6.dp))

                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded && !isUploading,
                    onExpandedChange = { if (!isUploading) dropdownExpanded = it }
                ) {
                    Box(
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                            .background(Color(0xFF141414), RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFF2E2E2E), RoundedCornerShape(6.dp))
                            .clickable(enabled = !isUploading) { dropdownExpanded = true }
                            .padding(horizontal = 12.dp, vertical = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = selectedPath,
                                color = Color(0xFF00F2FE),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Icon(
                                imageVector = if (dropdownExpanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                                contentDescription = null,
                                tint = Color.Gray
                            )
                        }
                    }

                    ExposedDropdownMenu(
                        expanded = dropdownExpanded && !isUploading,
                        onDismissRequest = { dropdownExpanded = false },
                        modifier = Modifier
                            .background(Color(0xFF111111))
                            .border(1.dp, Color(0xFF222222))
                    ) {
                        safePaths.forEach { path ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = path,
                                        color = if (path == selectedPath) Color(0xFF00F2FE) else Color.White,
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = if (path == selectedPath) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                onClick = {
                                    selectedPath = path
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // File Selection Area
                Text(
                    text = "SELECT MEDIA FILE",
                    color = Color(0xFF777777),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(6.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF141414), RoundedCornerShape(6.dp))
                        .border(
                            1.dp,
                            if (selectedUri != null) Color(0xFF00F2FE) else Color(0xFF2E2E2E),
                            RoundedCornerShape(6.dp)
                        )
                        .clickable(enabled = !isUploading) {
                            filePicker.launch("*/*")
                        }
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (selectedUri == null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.AddPhotoAlternate,
                                contentDescription = null,
                                tint = Color(0xFF00F2FE),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "TAP TO CHOOSE FILE",
                                color = Color(0xFFCCCCCC),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.InsertDriveFile,
                                contentDescription = null,
                                tint = Color(0xFF00F2FE),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = selectedFileName,
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = formatBytes(selectedFileSize),
                                    color = Color(0xFF888888),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }

                // Upload Telemetry & Progress
                if (isUploading && uploadProgress != null) {
                    val p = uploadProgress!!
                    Spacer(modifier = Modifier.height(14.dp))

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF141414), RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFF222222), RoundedCornerShape(6.dp))
                            .padding(12.dp)
                    ) {
                        LinearProgressIndicator(
                            progress = { p.progressFraction },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(5.dp),
                            color = Color(0xFF00F2FE),
                            trackColor = Color(0xFF222222),
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${formatBytes(p.bytesWritten)} / ${formatBytes(p.totalBytes)}",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "${(p.progressFraction * 100).toInt()}%",
                                color = Color(0xFF00F2FE),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Speed: ${formatSpeed(p.speedBytesPerSec)}",
                                color = Color(0xFF888888),
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = if (p.etaSeconds > 0) "ETA: ${p.etaSeconds}s" else if (p.isComplete) "Finishing..." else "",
                                color = Color(0xFF888888),
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        if (p.isComplete) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = if (p.isVerified) Icons.Default.CheckCircle else Icons.Default.HourglassBottom,
                                    contentDescription = null,
                                    tint = if (p.isVerified) Color(0xFF00FF66) else Color(0xFF00F2FE),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (p.isVerified) "Verified on Hugging Face!" else "Verifying commit...",
                                    color = if (p.isVerified) Color(0xFF00FF66) else Color(0xFF00F2FE),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // Error alert
                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = errorMessage ?: "",
                        color = Color(0xFFFF5555),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Action Button
                Button(
                    onClick = {
                        val uri = selectedUri ?: return@Button
                        isUploading = true
                        errorMessage = null

                        scope.launch {
                            uploader.uploadMedia(
                                context = context,
                                fileUri = uri,
                                fileName = selectedFileName,
                                destinationSubPath = selectedPath
                            ).collect { progress ->
                                uploadProgress = progress
                                if (progress.error != null) {
                                    errorMessage = progress.error
                                    isUploading = false
                                } else if (progress.isVerified) {
                                    isUploading = false
                                    onUploadSuccess()
                                    onDismissRequest()
                                }
                            }
                        }
                    },
                    enabled = selectedUri != null && !isUploading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF00F2FE),
                        contentColor = Color.Black,
                        disabledContainerColor = Color(0xFF1A1A1A),
                        disabledContentColor = Color(0xFF555555)
                    )
                ) {
                    Text(
                        text = if (isUploading) "UPLOADING TO VAULT..." else "START UPLOAD",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    }
}

private fun queryFileInfo(context: Context, uri: Uri): Pair<String, Long> {
    var name = "media_${System.currentTimeMillis()}"
    var size = 0L
    try {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex != -1) name = cursor.getString(nameIndex) ?: name
                if (sizeIndex != -1) size = cursor.getLong(sizeIndex)
            }
        }
    } catch (ignored: Exception) {}
    return Pair(name, size)
}

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0) return "0 B"
    val kb = bytes / 1024.0
    val mb = kb / 1024.0
    val gb = mb / 1024.0
    return when {
        gb >= 1.0 -> String.format(Locale.US, "%.2f GB", gb)
        mb >= 1.0 -> String.format(Locale.US, "%.1f MB", mb)
        kb >= 1.0 -> String.format(Locale.US, "%.0f KB", kb)
        else -> "$bytes B"
    }
}

private fun formatSpeed(bytesPerSec: Double): String {
    val mbps = bytesPerSec / (1024.0 * 1024.0)
    return String.format(Locale.US, "%.2f MB/s", mbps)
}
