package com.aibusinesscore.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://mohammadfadaiemacbook-coder.github.io/ai-business-core/";
    private static final int FILE_CHOOSER_REQUEST = 4102;
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
            if (!"github.com".equalsIgnoreCase(uri.getHost())) return;
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (ActivityNotFoundException e) { runOnUiThread(() -> Toast.makeText(MainActivity.this, "امکان باز کردن دانلود بروزرسانی وجود ندارد", Toast.LENGTH_LONG).show()); }
        }
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
                if ("mohammadfadaiemacbook-coder.github.io".equalsIgnoreCase(host)
                        || "ai-business-core.mohammadfadaiemacbook.workers.dev".equalsIgnoreCase(host)) return false;
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
        super.onDestroy();
    }
}
