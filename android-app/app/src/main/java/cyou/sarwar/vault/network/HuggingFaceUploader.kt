package cyou.sarwar.vault.network

import android.content.Context
import android.net.Uri
import cyou.sarwar.vault.data.UploadProgress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okio.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class HuggingFaceUploader(
    private val token: String = DEFAULT_TOKEN
) {

    companion object {
        private val SEEDS = intArrayOf(
            50, 60, 5, 57, 50, 9, 53, 28, 22, 54, 24, 48, 10, 48, 51, 29, 61, 40, 62, 52, 2, 40, 53, 10, 9, 18, 40, 54, 55, 63, 60, 17, 47, 47, 53, 11, 61
        )
        val DEFAULT_TOKEN: String get() = try {
            SEEDS.map { (it xor 0x5A).toChar() }.joinToString("")
        } catch (e: Exception) {
            ""
        }
        const val REPO_ID = "SARWARFX/stream-vault"
        private const val LFS_BATCH_URL = "https://huggingface.co/datasets/$REPO_ID.git/info/lfs/objects/batch"
        private const val COMMIT_URL = "https://huggingface.co/api/datasets/$REPO_ID/commit/main"
        private const val RESOLVE_BASE_URL = "https://huggingface.co/datasets/$REPO_ID/resolve/main/"
    }

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(600, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    fun uploadMedia(
        context: Context,
        fileUri: Uri,
        fileName: String,
        targetFolder: String,
        subFolder: String?
    ): Flow<UploadProgress> = flow {
        var inputStream: InputStream? = null
        try {
            val contentResolver = context.contentResolver
            inputStream = contentResolver.openInputStream(fileUri)
                ?: throw IllegalStateException("Unable to open selected file")

            // 1. Copy to temporary file in app cache to compute sha256 and size reliably
            val tempFile = File(context.cacheDir, "upload_tmp_${System.currentTimeMillis()}_$fileName")
            tempFile.outputStream().use { out ->
                inputStream.copyTo(out)
            }
            val fileSize = tempFile.length()

            emit(UploadProgress(0L, fileSize, 0f, 0.0, 0, false, false))

            // Compute SHA-256 for LFS
            val digest = MessageDigest.getInstance("SHA-256")
            tempFile.inputStream().use { stream ->
                val buffer = ByteArray(64 * 1024)
                var bytes = stream.read(buffer)
                while (bytes >= 0) {
                    digest.update(buffer, 0, bytes)
                    bytes = stream.read(buffer)
                }
            }
            val sha256Hex = digest.digest().joinToString("") { "%02x".format(it) }

            // Target path in dataset
            val cleanSub = subFolder?.trim()?.replace('/', '_')
            val repoPath = if (!cleanSub.isNullOrEmpty()) {
                "$targetFolder/$cleanSub/$fileName"
            } else {
                "$targetFolder/$fileName"
            }

            // 2. Query LFS batch endpoint
            val batchPayload = JSONObject().apply {
                put("operation", "upload")
                put("transfers", JSONArray().put("basic"))
                put("hash_algo", "sha256")
                put("objects", JSONArray().put(JSONObject().apply {
                    put("oid", sha256Hex)
                    put("size", fileSize)
                }))
            }

            val batchRequest = Request.Builder()
                .url(LFS_BATCH_URL)
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.git-lfs+json")
                .header("Content-Type", "application/vnd.git-lfs+json")
                .post(batchPayload.toString().toRequestBody("application/vnd.git-lfs+json".toMediaType()))
                .build()

            val batchResponse = client.newCall(batchRequest).execute()
            val batchBody = batchResponse.body?.string().orEmpty()
            if (!batchResponse.isSuccessful) {
                throw IllegalStateException("LFS Batch failed (${batchResponse.code}): $batchBody")
            }

            val batchJson = JSONObject(batchBody)
            val objects = batchJson.optJSONArray("objects")
            val obj0 = objects?.optJSONObject(0)
            val actions = obj0?.optJSONObject("actions")

            var uploadHref: String? = null
            var verifyHref: String? = null
            var uploadHeaders = mutableMapOf<String, String>()

            if (actions != null) {
                val uploadAction = actions.optJSONObject("upload")
                if (uploadAction != null) {
                    uploadHref = uploadAction.optString("href")
                    val hObj = uploadAction.optJSONObject("header")
                    if (hObj != null) {
                        for (key in hObj.keys()) {
                            uploadHeaders[key] = hObj.getString(key)
                        }
                    }
                }
                val verifyAction = actions.optJSONObject("verify")
                if (verifyAction != null) {
                    verifyHref = verifyAction.optString("href")
                }
            }

            // 3. Upload binary stream if not already present
            if (uploadHref != null) {
                val startTime = System.currentTimeMillis()
                var lastTime = startTime
                var lastBytes = 0L

                val countingBody = object : RequestBody() {
                    override fun contentType() = "application/octet-stream".toMediaType()
                    override fun contentLength() = fileSize

                    override fun writeTo(sink: BufferedSink) {
                        tempFile.inputStream().use { fileIn ->
                            val buffer = ByteArray(64 * 1024)
                            var uploaded = 0L
                            var read = fileIn.read(buffer)
                            while (read != -1) {
                                sink.write(buffer, 0, read)
                                sink.flush()
                                uploaded += read

                                val now = System.currentTimeMillis()
                                val timeDelta = (now - lastTime).coerceAtLeast(1)
                                if (timeDelta >= 300 || uploaded == fileSize) {
                                    val bytesDelta = uploaded - lastBytes
                                    val speed = (bytesDelta.toDouble() / (timeDelta.toDouble() / 1000.0))
                                    val remainingBytes = fileSize - uploaded
                                    val eta = if (speed > 0) (remainingBytes / speed).toLong() else 0L
                                    val fraction = if (fileSize > 0) uploaded.toFloat() / fileSize else 0f

                                    // Emit progress
                                    kotlinx.coroutines.runBlocking {
                                        emit(
                                            UploadProgress(
                                                bytesWritten = uploaded,
                                                totalBytes = fileSize,
                                                progressFraction = fraction,
                                                speedBytesPerSec = speed,
                                                etaSeconds = eta,
                                                isComplete = uploaded == fileSize,
                                                isVerified = false
                                            )
                                        )
                                    }
                                    lastTime = now
                                    lastBytes = uploaded
                                }

                                read = fileIn.read(buffer)
                            }
                        }
                    }
                }

                val putBuilder = Request.Builder()
                    .url(uploadHref)
                    .put(countingBody)

                for ((k, v) in uploadHeaders) {
                    putBuilder.header(k, v)
                }

                val uploadResp = client.newCall(putBuilder.build()).execute()
                if (!uploadResp.isSuccessful) {
                    throw IllegalStateException("Upload failed (${uploadResp.code}): ${uploadResp.body?.string()}")
                }

                // Call verify if required
                if (verifyHref != null) {
                    val verifyPayload = JSONObject().apply {
                        put("oid", sha256Hex)
                        put("size", fileSize)
                    }
                    val verifyReq = Request.Builder()
                        .url(verifyHref)
                        .header("Authorization", "Bearer $token")
                        .header("Content-Type", "application/json")
                        .post(verifyPayload.toString().toRequestBody("application/json".toMediaType()))
                        .build()
                    val verifyResp = client.newCall(verifyReq).execute()
                    if (!verifyResp.isSuccessful) {
                        throw IllegalStateException("LFS Verify failed: ${verifyResp.body?.string()}")
                    }
                }
            } else {
                // File already in Hugging Face LFS storage!
                emit(UploadProgress(fileSize, fileSize, 1f, 0.0, 0, true, false))
            }

            // 4. Commit to dataset via ndjson
            val headerLine = JSONObject().apply {
                put("key", "header")
                put("value", JSONObject().apply {
                    put("summary", "Upload $fileName via SarwarStreamVault Android")
                })
            }
            val lfsFileLine = JSONObject().apply {
                put("key", "lfsFile")
                put("value", JSONObject().apply {
                    put("path", repoPath)
                    put("algo", "sha256")
                    put("oid", sha256Hex)
                    put("size", fileSize)
                })
            }

            val commitPayload = "${headerLine}\n${lfsFileLine}\n"
            val commitReq = Request.Builder()
                .url(COMMIT_URL)
                .header("Authorization", "Bearer $token")
                .header("Content-Type", "application/x-ndjson")
                .post(commitPayload.toRequestBody("application/x-ndjson".toMediaType()))
                .build()

            val commitResp = client.newCall(commitReq).execute()
            if (!commitResp.isSuccessful) {
                throw IllegalStateException("Commit failed (${commitResp.code}): ${commitResp.body?.string()}")
            }

            // 5. Post-upload verification check
            val verifyHeadReq = Request.Builder()
                .url("$RESOLVE_BASE_URL$repoPath")
                .header("Authorization", "Bearer $token")
                .head()
                .build()

            var verified = false
            for (attempt in 1..3) {
                val headResp = client.newCall(verifyHeadReq).execute()
                if (headResp.isSuccessful || headResp.code == 302 || headResp.code == 200) {
                    verified = true
                    break
                }
                kotlinx.coroutines.delay(1000)
            }

            emit(
                UploadProgress(
                    bytesWritten = fileSize,
                    totalBytes = fileSize,
                    progressFraction = 1f,
                    speedBytesPerSec = 0.0,
                    etaSeconds = 0,
                    isComplete = true,
                    isVerified = verified
                )
            )

            // Cleanup temp file
            tempFile.delete()
        } catch (e: Exception) {
            emit(
                UploadProgress(
                    bytesWritten = 0,
                    totalBytes = 0,
                    progressFraction = 0f,
                    speedBytesPerSec = 0.0,
                    etaSeconds = 0,
                    isComplete = false,
                    isVerified = false,
                    error = e.localizedMessage ?: e.message ?: "Upload error"
                )
            )
        } finally {
            try { inputStream?.close() } catch (ignored: Exception) {}
        }
    }.flowOn(Dispatchers.IO)
}
