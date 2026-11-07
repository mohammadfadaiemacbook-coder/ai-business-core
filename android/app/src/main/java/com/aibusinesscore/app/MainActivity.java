package com.aibusinesscore.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.content.pm.PackageInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://mohammadfadaiemacbook-coder.github.io/ai-business-core/";
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final String RELEASES_API = "https://api.github.com/repos/mohammadfadaiemacbook-coder/ai-business-core/releases?per_page=100";
    private static final Pattern ANDROID_TAG = Pattern.compile("^android-v([0-9]+)$");
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    public class AppBridge {
        @JavascriptInterface public int getVersionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }
        @JavascriptInterface public void openUpdate(String url) {
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"github.com".equalsIgnoreCase(uri.getHost()) || uri.getPath() == null || !uri.getPath().startsWith("/mohammadfadaiemacbook-coder/ai-business-core/releases/download/android-v") || !uri.getPath().endsWith("/app-debug.apk")) return;
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (ActivityNotFoundException e) { runOnUiThread(() -> Toast.makeText(MainActivity.this, "امکان باز کردن دانلود بروزرسانی وجود ندارد", Toast.LENGTH_LONG).show()); }
        }
    }

    private void checkForUpdates() {
        updateExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(RELEASES_API).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("User-Agent", "AI-Business-Core-Android");
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                String payload;
                try (InputStream input = connection.getInputStream();
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    payload = output.toString(StandardCharsets.UTF_8.name());
                }
                JSONArray releases = new JSONArray(payload);
                int latestVersion = 0;
                String downloadUrl = "";
                for (int i = 0; i < releases.length(); i++) {
                    JSONObject release = releases.optJSONObject(i);
                    if (release == null || release.optBoolean("draft") || release.optBoolean("prerelease")) continue;
                    Matcher matcher = ANDROID_TAG.matcher(release.optString("tag_name", ""));
                    if (!matcher.matches()) continue;
                    int candidateVersion;
                    try { candidateVersion = Integer.parseInt(matcher.group(1)); }
                    catch (NumberFormatException ignored) { continue; }
                    JSONArray assets = release.optJSONArray("assets");
                    if (assets == null) continue;
                    String candidateUrl = "";
                    for (int j = 0; j < assets.length(); j++) {
                        JSONObject asset = assets.optJSONObject(j);
                        if (asset == null || !"app-debug.apk".equals(asset.optString("name"))) continue;
                        String url = asset.optString("browser_download_url", "");
                        Uri uri = Uri.parse(url);
                        if ("https".equalsIgnoreCase(uri.getScheme())
                                && "github.com".equalsIgnoreCase(uri.getHost())
                                && uri.getPath() != null
                                && uri.getPath().startsWith("/mohammadfadaiemacbook-coder/ai-business-core/releases/download/android-v")
                                && uri.getPath().endsWith("/app-debug.apk")) {
                            candidateUrl = url;
                            break;
                        }
                    }
                    if (!candidateUrl.isEmpty() && candidateVersion > latestVersion) {
                        latestVersion = candidateVersion;
                        downloadUrl = candidateUrl;
                    }
                }
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                long installedVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? info.getLongVersionCode() : info.versionCode;
                if (latestVersion > installedVersion && !downloadUrl.isEmpty()) {
                    final int version = latestVersion;
                    final String url = downloadUrl;
                    mainHandler.post(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("بروزرسانی AI Business Core")
                                .setMessage("نسخهٔ جدید 1.0." + version + " آماده است. مایل به دریافت فایل نصب هستی؟")
                                .setPositiveButton("دریافت بروزرسانی", (dialog, which) -> new AppBridge().openUpdate(url))
                                .setNegativeButton("بعداً", null)
                                .show();
                    });
                }
            } catch (Exception error) {
                android.util.Log.w("AIBusinessCore", "Android update check failed", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if ("https".equalsIgnoreCase(uri.getScheme()) && ("mohammadfadaiemacbook-coder.github.io".equalsIgnoreCase(host)
                        || "ai-business-core.mohammadfadaiemacbook.workers.dev".equalsIgnoreCase(host))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "امکان باز کردن پیوند وجود ندارد", Toast.LENGTH_SHORT).show(); }
                return true;
            }
        });
        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST); }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
                return true;
            }
        });
        if (savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
        checkForUpdates();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (webView != null) { webView.stopLoading(); webView.destroy(); }
        updateExecutor.shutdownNow();
        super.onDestroy();
    }
}
