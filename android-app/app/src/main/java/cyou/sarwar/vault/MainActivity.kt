package cyou.sarwar.vault

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import cyou.sarwar.vault.data.MediaRepository
import cyou.sarwar.vault.ui.FolderTreeScreen

class MainActivity : ComponentActivity() {

    private val mediaRepository by lazy {
        MediaRepository(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color.Black
            ) {
                FolderTreeScreen(repository = mediaRepository)
            }
        }
    }
}
