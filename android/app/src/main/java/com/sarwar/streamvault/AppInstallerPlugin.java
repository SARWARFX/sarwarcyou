package com.sarwar.streamvault;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
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
import java.util.List;

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
    public void installApk(PluginCall call) {
        String fileName = call.getString("fileName", "SARWARCYOU-update.apk");
        try {
            Context context = getContext();
            File cacheDir = context.getExternalCacheDir();
            if (cacheDir == null) {
                cacheDir = context.getCacheDir();
            }
            File outputFile = new File(cacheDir, fileName);
            if (!outputFile.exists() || outputFile.length() == 0) {
                call.reject("Downloaded APK file not found on disk: " + fileName);
                return;
            }

            boolean needsPerm = triggerInstall(outputFile);
            JSObject res = new JSObject();
            res.put("success", !needsPerm);
            res.put("needsPermission", needsPerm);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Installation trigger failed: " + e.getMessage(), e);
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
                    if (!cacheDir.exists()) {
                        cacheDir.mkdirs();
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
                        if (now - lastEmitTime > 100 || total == fileLength) {
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

                    // Launch native installation intent or guide to settings
                    boolean needsPermission = triggerInstall(outputFile);

                    JSObject res = new JSObject();
                    res.put("success", !needsPermission);
                    res.put("needsPermission", needsPermission);
                    if (needsPermission) {
                        notifyListeners("permissionNeeded", new JSObject());
                    }
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

    /**
     * Launch the native Android package installer.
     * Returns true if user needs to grant REQUEST_INSTALL_PACKAGES first, false if intent launched.
     */
    private boolean triggerInstall(File apkFile) {
        Context context = getContext();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(settingsIntent);
                } catch (Exception ignored) {}
                return true;
            }
        }

        Uri apkUri = FileProvider.getUriForFile(
            context,
            context.getPackageName() + ".fileprovider",
            apkFile
        );

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        try {
            List<ResolveInfo> resInfoList = context.getPackageManager().queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                context.grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        } catch (Exception ignored) {}

        getActivity().startActivity(intent);
        return false;
    }

    private HttpURLConnection openConnectionWithRedirects(String urlString) throws IOException {
        String currentUrl = urlString;
        int redirectCount = 0;
        final int MAX_REDIRECTS = 10;

        while (redirectCount < MAX_REDIRECTS) {
            URL url = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "*/*");
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            conn.connect();

            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_TEMP ||
                status == HttpURLConnection.HTTP_MOVED_PERM ||
                status == HttpURLConnection.HTTP_SEE_OTHER ||
                status == 307 || status == 308) {

                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IOException("Redirect received with empty Location header");
                }
                URL nextUrl = new URL(url, location);
                currentUrl = nextUrl.toExternalForm();
                redirectCount++;
            } else {
                return conn;
            }
        }
        throw new IOException("Too many redirects: " + redirectCount);
    }
}
