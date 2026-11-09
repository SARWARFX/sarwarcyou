package com.sarwar.streamvault;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = context.getPackageManager().canRequestPackageInstalls();
            JSObject ret = new JSObject();
            ret.put("value", canInstall);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Context context = getContext();
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open settings: " + e.getMessage(), e);
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        final String fileName = call.getString("fileName", "SARWARCYOU-update.apk");

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection connection = null;
                InputStream input = null;
                FileOutputStream output = null;

                try {
                    Context context = getContext();
                    File cacheDir = context.getExternalCacheDir();
                    if (cacheDir == null) {
                        cacheDir = context.getCacheDir();
                    }

                    File outputFile = new File(cacheDir, fileName);
                    if (outputFile.exists()) {
                        outputFile.delete();
                    }

                    connection = openConnectionWithRedirects(apkUrl);
                    int responseCode = connection.getResponseCode();
                    if (responseCode != HttpURLConnection.HTTP_OK) {
                        throw new IOException("Server returned HTTP " + responseCode + " " + connection.getResponseMessage());
                    }

                    int fileLength = connection.getContentLength();
                    input = connection.getInputStream();
                    output = new FileOutputStream(outputFile);

                    byte[] data = new byte[8192];
                    long total = 0;
                    int count;
                    long lastEmitTime = 0;

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);

                        long now = System.currentTimeMillis();
                        if (now - lastEmitTime > 80 || total == fileLength) {
                            lastEmitTime = now;
                            int percent = fileLength > 0 ? (int) ((total * 100) / fileLength) : 0;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("bytesReceived", total);
                            progress.put("totalBytes", fileLength);
                            notifyListeners("downloadProgress", progress);
                        }
                    }

                    output.flush();
                    output.close();
                    output = null;

                    input.close();
                    input = null;

                    notifyListeners("downloadComplete", new JSObject());

                    // Launch native installation intent
                    triggerInstall(outputFile);

                    JSObject res = new JSObject();
                    res.put("success", true);
                    call.resolve(res);

                } catch (Exception e) {
                    JSObject err = new JSObject();
                    err.put("error", e.getMessage());
                    notifyListeners("downloadFailed", err);
                    call.reject("Download/Install failed: " + e.getMessage(), e);
                } finally {
                    try {
                        if (output != null) output.close();
                        if (input != null) input.close();
                    } catch (IOException ignored) {}
                    if (connection != null) connection.disconnect();
                }
            }
        }).start();
    }

    private void triggerInstall(File apkFile) {
        Context context = getContext();
        Uri apkUri = FileProvider.getUriForFile(
            context,
            context.getPackageName() + ".fileprovider",
            apkFile
        );

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        getActivity().startActivity(intent);
    }

    private HttpURLConnection openConnectionWithRedirects(String urlString) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Sarwarcyou-Updater/1.0");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.connect();

        int status = conn.getResponseCode();
        int redirectCount = 0;
        while ((status == HttpURLConnection.HTTP_MOVED_TEMP ||
                status == HttpURLConnection.HTTP_MOVED_PERM ||
                status == HttpURLConnection.HTTP_SEE_OTHER ||
                status == 307 || status == 308) && redirectCount < 5) {
            String newUrl = conn.getHeaderField("Location");
            if (newUrl == null) break;
            conn.disconnect();
            url = new URL(newUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Sarwarcyou-Updater/1.0");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.connect();
            status = conn.getResponseCode();
            redirectCount++;
        }
        return conn;
    }
}
