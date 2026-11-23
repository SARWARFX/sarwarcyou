package cyou.sarwar.vault.ui

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import cyou.sarwar.vault.data.MainFolder
import cyou.sarwar.vault.data.MediaItem
import cyou.sarwar.vault.data.MediaRepository
import cyou.sarwar.vault.data.SubFolder
import cyou.sarwar.vault.network.UpdateChecker
import cyou.sarwar.vault.utils.CacheManager
import cyou.sarwar.vault.utils.MediaLauncher
import kotlinx.coroutines.launch

@Composable
fun FolderTreeScreen(
    repository: MediaRepository
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var mainFolders by remember { mutableStateOf<List<MainFolder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showUploadDialog by remember { mutableStateOf(false) }
    var showUpdateDialog by remember { mutableStateOf(false) }
    var currentOpeningItem by remember { mutableStateOf<String?>(null) }

    fun refreshFolders(force: Boolean = false) {
        isLoading = true
        scope.launch {
            mainFolders = repository.getFolders(forceRefresh = force)
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshFolders(forceRefresh = false)
        // Clean any leftover update files from previous install
        UpdateChecker.cleanupPendingUpdate(context)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Top Bar: Title & Upload Button (Top-Right)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "SARWAR VAULT",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = "STREAM VAULT MEDIA",
                        color = Color(0xFF666666),
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }

                // Top-Right Upload Button
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showUploadDialog = true },
                    color = Color(0xFF111111),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF00F2FE))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = "Upload",
                            tint = Color(0xFF00F2FE),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "UPLOAD",
                            color = Color(0xFF00F2FE),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }

            HorizontalDivider(color = Color(0xFF1A1A1A), thickness = 1.dp)

            // Middle: Scrollable Folders & Subfolders Tree
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.TopCenter
            ) {
                if (isLoading) {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(
                            color = Color(0xFF00F2FE),
                            modifier = Modifier.size(36.dp),
                            strokeWidth = 3.dp
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "Loading media tree...",
                            color = Color(0xFF666666),
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                } else if (mainFolders.isEmpty()) {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "No media folders found",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { refreshFolders(force = true) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E1E1E))
                        ) {
                            Text(text = "Retry", color = Color.White)
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        contentPadding = PaddingValues(top = 16.dp, bottom = 80.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(mainFolders) { folder ->
                            MainFolderCard(
                                folder = folder,
                                onItemClick = { item ->
                                    currentOpeningItem = item.name
                                    scope.launch {
                                        Toast.makeText(context, "Opening ${item.name}...", Toast.LENGTH_SHORT).show()
                                        val res = CacheManager.getOrDownloadMediaFile(context, item)
                                        currentOpeningItem = null
                                        res.fold(
                                            onSuccess = { file ->
                                                MediaLauncher.launchMedia(context, file, item.isVideo)
                                            },
                                            onFailure = { err ->
                                                Toast.makeText(
                                                    context,
                                                    "Failed to open: ${err.message}",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                        )
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // Bottom Bar with Bottom-Left Update Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF080808))
                    .border(1.dp, Color(0xFF1A1A1A))
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Bottom-Left Update Check Button
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showUpdateDialog = true },
                    color = Color(0xFF141414),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF2E2E2E))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.SystemUpdate,
                            contentDescription = "Check Update",
                            tint = Color(0xFF00F2FE),
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "CHECK UPDATE",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        )
                    }
                }

                // App version indicator on the right
                Text(
                    text = "v${UpdateChecker.getCurrentVersion(context)}",
                    color = Color(0xFF555555),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.align(Alignment.CenterEnd)
                )
            }
        }

        // Active Opening Progress Toast / Spinner Overlay
        if (currentOpeningItem != null) {
            Surface(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp),
                shape = RoundedCornerShape(10.dp),
                color = Color(0xEE111111),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF00F2FE))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color(0xFF00F2FE),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Opening ${currentOpeningItem}...",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }

    if (showUploadDialog) {
        UploadDialog(
            onDismissRequest = { showUploadDialog = false },
            onUploadSuccess = {
                refreshFolders(force = true)
            }
        )
    }

    if (showUpdateDialog) {
        UpdateDialog(
            onDismissRequest = { showUpdateDialog = false }
        )
    }
}

@Composable
fun MainFolderCard(
    folder: MainFolder,
    onItemClick: (MediaItem) -> Unit
) {
    var isExpanded by remember { mutableStateOf(folder.isExpanded) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF0C0C0C))
            .border(1.dp, Color(0xFF1E1E1E), RoundedCornerShape(10.dp))
    ) {
        // Main Folder Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = when (folder.iconName) {
                        "photo" -> Icons.Default.PhotoLibrary
                        "play_arrow" -> Icons.Default.PlayCircle
                        "video_library" -> Icons.Default.VideoLibrary
                        "favorite" -> Icons.Default.Favorite
                        else -> Icons.Default.Folder
                    },
                    contentDescription = null,
                    tint = Color(0xFF00F2FE),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = folder.displayName,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.width(8.dp))
                val totalItems = folder.subFolders.sumOf { it.items.size } + folder.directItems.size
                Text(
                    text = "($totalItems)",
                    color = Color(0xFF777777),
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Icon(
                imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                tint = Color.Gray
            )
        }

        // Subfolders Opened Under Main Folder
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // If there are subfolders
                folder.subFolders.forEach { sub ->
                    SubFolderSection(
                        subFolder = sub,
                        onItemClick = onItemClick
                    )
                }

                // If direct items under main folder exist
                if (folder.directItems.isNotEmpty()) {
                    DirectItemsSection(
                        items = folder.directItems,
                        onItemClick = onItemClick
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))
            }
        }
    }
}

@Composable
fun SubFolderSection(
    subFolder: SubFolder,
    onItemClick: (MediaItem) -> Unit
) {
    var isExpanded by remember { mutableStateOf(subFolder.isExpanded) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF141414))
            .border(1.dp, Color(0xFF242424), RoundedCornerShape(8.dp))
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.FolderOpen,
                    contentDescription = null,
                    tint = Color(0xFF00F2FE).copy(alpha = 0.8f),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = subFolder.name,
                    color = Color(0xFFEEEEEE),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "[${subFolder.items.size}]",
                    color = Color(0xFF666666),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Icon(
                imageVector = if (isExpanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = Color.DarkGray,
                modifier = Modifier.size(20.dp)
            )
        }

        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(subFolder.items) { item ->
                    MediaThumbnailItem(
                        item = item,
                        onClick = { onItemClick(item) }
                    )
                }
            }
        }
    }
}

@Composable
fun DirectItemsSection(
    items: List<MediaItem>,
    onItemClick: (MediaItem) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF141414))
            .border(1.dp, Color(0xFF242424), RoundedCornerShape(8.dp))
            .padding(10.dp)
    ) {
        Text(
            text = "Root Files [${items.size}]",
            color = Color(0xFF888888),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(items) { item ->
                MediaThumbnailItem(
                    item = item,
                    onClick = { onItemClick(item) }
                )
            }
        }
    }
}

@Composable
fun MediaThumbnailItem(
    item: MediaItem,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(100.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .width(100.dp)
                .height(130.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFF1D1D1D))
                .border(1.dp, Color(0xFF2E2E2E), RoundedCornerShape(6.dp)),
            contentAlignment = Alignment.Center
        ) {
            // Thumbnail or Placeholder
            AsyncImage(
                model = item.thumbnailUrl ?: item.url,
                contentDescription = item.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            // Video overlay badge
            if (item.isVideo) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(32.dp)
                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = item.name,
            color = Color(0xFFCCCCCC),
            fontSize = 10.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontFamily = FontFamily.Monospace
        )
    }
}
