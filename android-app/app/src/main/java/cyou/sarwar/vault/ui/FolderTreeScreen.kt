package cyou.sarwar.vault.ui

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
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
import java.util.Locale

@Composable
fun FolderTreeScreen(
    repository: MediaRepository
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    var mainFolders by remember { mutableStateOf<List<MainFolder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    var selectedMajorName by remember { mutableStateOf("Photographs") }
    var selectedSubName by remember { mutableStateOf("Older") }
    var expandedMajors by remember { mutableStateOf(setOf("Photographs")) }

    var showUploadDialog by remember { mutableStateOf(false) }
    var showUpdateDialog by remember { mutableStateOf(false) }
    var currentOpeningItem by remember { mutableStateOf<String?>(null) }

    fun refreshFolders(force: Boolean = false) {
        isLoading = true
        scope.launch {
            val list = repository.getFolders(forceRefresh = force)
            mainFolders = list
            isLoading = false

            // Default selection if available
            if (list.isNotEmpty()) {
                val currentMajor = list.find { it.name == selectedMajorName } ?: list.first()
                selectedMajorName = currentMajor.name
                if (currentMajor.subFolders.isNotEmpty() && currentMajor.subFolders.none { it.name == selectedSubName }) {
                    selectedSubName = currentMajor.subFolders.first().name
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        refreshFolders(force = false)
        UpdateChecker.cleanupPendingUpdate(context)
    }

    // Collect all valid subfolder paths for the strict upload dropdown
    val availableUploadPaths = remember(mainFolders) {
        mainFolders.flatMap { major ->
            major.subFolders.map { sub -> "${major.name}/${sub.name}" }
        }
    }

    // Current displayed media items
    val currentMediaItems = remember(mainFolders, selectedMajorName, selectedSubName) {
        val major = mainFolders.find { it.name == selectedMajorName }
        val sub = major?.subFolders?.find { it.name == selectedSubName }
        sub?.items ?: major?.directItems ?: emptyList()
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = true,
        scrimColor = Color.Black.copy(alpha = 0.8f),
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF070707),
                drawerContentColor = Color.White,
                modifier = Modifier
                    .width(310.dp)
                    .fillMaxHeight()
                    .border(1.dp, Color(0xFF1C1C1C))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Top Drawer Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 18.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "MEDIA FOLDERS",
                            color = Color(0xFF777777),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.5.sp
                        )
                        IconButton(
                            onClick = { scope.launch { drawerState.close() } },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close Drawer",
                                tint = Color.Gray,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    HorizontalDivider(color = Color(0xFF181818), thickness = 1.dp)

                    // Middle Scrollable: 4 Major Folders & Subfolder Dropdowns
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        mainFolders.forEach { major ->
                            val isExpanded = expandedMajors.contains(major.name)
                            val totalFiles = major.subFolders.sumOf { it.items.size } + major.directItems.size

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFF0C0C0C))
                                    .border(1.dp, Color(0xFF1C1C1C), RoundedCornerShape(6.dp))
                            ) {
                                // Major Folder Header (Dropdown trigger)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            expandedMajors = if (isExpanded) {
                                                expandedMajors - major.name
                                            } else {
                                                expandedMajors + major.name
                                            }
                                        }
                                        .padding(horizontal = 12.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = when (major.iconName) {
                                                "photo" -> Icons.Default.PhotoLibrary
                                                "play_arrow" -> Icons.Default.PlayCircle
                                                "video_library" -> Icons.Default.VideoLibrary
                                                else -> Icons.Default.Favorite
                                            },
                                            contentDescription = null,
                                            tint = Color(0xFF00F2FE),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = major.displayName,
                                            color = Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "($totalFiles)",
                                            color = Color(0xFF666666),
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }

                                    Icon(
                                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                        contentDescription = null,
                                        tint = if (isExpanded) Color(0xFF00F2FE) else Color(0xFF666666),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                // Subfolders Dropdown Menu
                                AnimatedVisibility(
                                    visible = isExpanded,
                                    enter = expandVertically() + fadeIn(),
                                    exit = shrinkVertically() + fadeOut()
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Color(0xFF060606))
                                            .border(1.dp, Color(0xFF141414))
                                    ) {
                                        major.subFolders.forEach { sub ->
                                            val isActive = (selectedMajorName == major.name && selectedSubName == sub.name)
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(
                                                        if (isActive) Color(0xFF00F2FE).copy(alpha = 0.12f)
                                                        else Color.Transparent
                                                    )
                                                    .clickable {
                                                        selectedMajorName = major.name
                                                        selectedSubName = sub.name
                                                        scope.launch { drawerState.close() }
                                                    }
                                                    .padding(start = 36.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = sub.name,
                                                    color = if (isActive) Color(0xFF00F2FE) else Color(0xFFCCCCCC),
                                                    fontSize = 12.sp,
                                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                                    fontFamily = FontFamily.Monospace
                                                )
                                                Box(
                                                    modifier = Modifier
                                                        .background(
                                                            if (isActive) Color(0xFF00F2FE).copy(alpha = 0.2f)
                                                            else Color(0xFF141414),
                                                            RoundedCornerShape(4.dp)
                                                        )
                                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = "${sub.items.size}",
                                                        color = if (isActive) Color(0xFF00F2FE) else Color(0xFF666666),
                                                        fontSize = 10.sp,
                                                        fontFamily = FontFamily.Monospace
                                                    )
                                                }
                                            }
                                        }

                                        // Direct root items if any
                                        if (major.directItems.isNotEmpty()) {
                                            val isActive = (selectedMajorName == major.name && selectedSubName == "Root")
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clickable {
                                                        selectedMajorName = major.name
                                                        selectedSubName = "Root"
                                                        scope.launch { drawerState.close() }
                                                    }
                                                    .padding(start = 36.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "Root Files",
                                                    color = if (isActive) Color(0xFF00F2FE) else Color(0xFF888888),
                                                    fontSize = 12.sp,
                                                    fontFamily = FontFamily.Monospace
                                                )
                                                Text(
                                                    text = "${major.directItems.size}",
                                                    color = Color(0xFF666666),
                                                    fontSize = 10.sp,
                                                    fontFamily = FontFamily.Monospace
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = Color(0xFF181818), thickness = 1.dp)

                    // Bottom Drawer Actions: Upload & App Update Buttons
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF040404))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                scope.launch { drawerState.close() }
                                showUploadDialog = true
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00F2FE),
                                contentColor = Color.Black
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.CloudUpload,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "UPLOAD MEDIA",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 0.5.sp
                            )
                        }

                        OutlinedButton(
                            onClick = {
                                scope.launch { drawerState.close() }
                                showUpdateDialog = true
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(40.dp),
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF2E2E2E)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color.White
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.SystemUpdate,
                                contentDescription = null,
                                tint = Color(0xFF00F2FE),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "APP UPDATE (${UpdateChecker.getCurrentVersion(context)})",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }
        }
    ) {
        // Main Screen Content
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            Column(modifier = Modifier.fillMaxSize()) {

                // App Header with Animated Hamburger / Cross Button
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .background(Color.Black)
                        .padding(horizontal = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Animated 3-line to Cross Button
                    HamburgerCrossButton(
                        isOpen = drawerState.isOpen,
                        onClick = {
                            scope.launch {
                                if (drawerState.isOpen) drawerState.close() else drawerState.open()
                            }
                        }
                    )

                    // Centered Title & Breadcrumb
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "STREAM VAULT",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.5.sp
                        )
                        Text(
                            text = "$selectedMajorName / $selectedSubName",
                            color = Color(0xFF00F2FE),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        )
                    }

                    // Right Live Status Pill
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF00FF66).copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                            .border(1.dp, Color(0xFF00FF66).copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(Color(0xFF00FF66), CircleShape)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "LIVE",
                                color = Color(0xFF00FF66),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFF1A1A1A), thickness = 1.dp)

                // Subfolder Title Header & Count
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "$selectedMajorName › $selectedSubName",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "${currentMediaItems.size} files",
                        color = Color(0xFF777777),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Full Page Media Grid
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    if (isLoading) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(
                                color = Color(0xFF00F2FE),
                                modifier = Modifier.size(34.dp),
                                strokeWidth = 3.dp
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Loading media from sarwar.cyou...",
                                color = Color(0xFF777777),
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    } else if (currentMediaItems.isEmpty()) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "No media files in this subfolder",
                                color = Color.Gray,
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Button(
                                onClick = { refreshFolders(force = true) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E1E1E))
                            ) {
                                Text(text = "Refresh", color = Color.White)
                            }
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 120.dp),
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 12.dp),
                            contentPadding = PaddingValues(bottom = 24.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(currentMediaItems, key = { it.id }) { item ->
                                FullPageMediaCard(
                                    item = item,
                                    onClick = {
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
            }

            // Spinner Overlay when opening/downloading media
            if (currentOpeningItem != null) {
                Surface(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xEE0B0B0B),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF00F2FE))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = Color(0xFF00F2FE),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
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
    }

    if (showUploadDialog) {
        UploadDialog(
            availablePaths = availableUploadPaths,
            initialPath = "$selectedMajorName/$selectedSubName",
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

/**
 * Animated 3-line hamburger button that transforms into a cross (✕).
 */
@Composable
fun HamburgerCrossButton(
    isOpen: Boolean,
    onClick: () -> Unit
) {
    val topBarRotate by animateFloatAsState(
        targetValue = if (isOpen) 45f else 0f,
        animationSpec = tween(300),
        label = "topBarRotate"
    )
    val topBarTranslateY by animateFloatAsState(
        targetValue = if (isOpen) 7f else 0f,
        animationSpec = tween(300),
        label = "topBarTranslateY"
    )
    val middleBarAlpha by animateFloatAsState(
        targetValue = if (isOpen) 0f else 1f,
        animationSpec = tween(200),
        label = "middleBarAlpha"
    )
    val bottomBarRotate by animateFloatAsState(
        targetValue = if (isOpen) -45f else 0f,
        animationSpec = tween(300),
        label = "bottomBarRotate"
    )
    val bottomBarTranslateY by animateFloatAsState(
        targetValue = if (isOpen) -7f else 0f,
        animationSpec = tween(300),
        label = "bottomBarTranslateY"
    )

    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(6.dp))
            .clickable(onClick = onClick)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Line 1
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(2.dp)
                    .graphicsLayer {
                        translationY = topBarTranslateY
                        rotationZ = topBarRotate
                    }
                    .background(if (isOpen) Color(0xFF00F2FE) else Color.White, RoundedCornerShape(1.dp))
            )

            // Line 2 (Middle)
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(2.dp)
                    .graphicsLayer {
                        alpha = middleBarAlpha
                    }
                    .background(Color.White, RoundedCornerShape(1.dp))
            )

            // Line 3
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(2.dp)
                    .graphicsLayer {
                        translationY = bottomBarTranslateY
                        rotationZ = bottomBarRotate
                    }
                    .background(if (isOpen) Color(0xFF00F2FE) else Color.White, RoundedCornerShape(1.dp))
            )
        }
    }
}

/**
 * Full page media thumbnail card with video badge and gradient info bar.
 */
@Composable
fun FullPageMediaCard(
    item: MediaItem,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(9f / 13.5f)
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF0C0C0C))
            .border(1.dp, Color(0xFF1E1E1E), RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = item.thumbnailUrl ?: item.url,
            contentDescription = item.name,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // Video Play Overlay Badge
        if (item.isVideo) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(34.dp)
                    .background(Color.Black.copy(alpha = 0.65f), CircleShape)
                    .border(1.dp, Color.White.copy(alpha = 0.35f), CircleShape),
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

        // Bottom Gradient Bar with name & size
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.65f),
                            Color.Black.copy(alpha = 0.95f)
                        )
                    )
                )
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Column {
                Text(
                    text = item.name,
                    color = Color.White,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
                if (item.size > 0L) {
                    Text(
                        text = formatBytes(item.size),
                        color = Color(0xFF888888),
                        fontSize = 8.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
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
