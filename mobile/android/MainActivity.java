package io.github.kshitizchingawat.unilink;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOST = "unilink-frontend-omky.onrender.com";
    private static final String START = "https://" + HOST + "/dashboard";
    private static final int PICK_FILES = 1;
    private WebView web;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> selectedFiles;
    private String retryUrl = START;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(15, 23, 42));
        root.setFitsSystemWindows(true);
        setContentView(root);
        web = new WebView(this);
        root.addView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " UniLinkNative/1");
        CookieManager.getInstance().setAcceptCookie(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() || isWorkspace(request.getUrl())) return false;
                openExternal(request.getUrl());
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showRetry(request.getUrl());
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showRetry(request.getUrl());
            }
        });
        web.setDownloadListener((url, ua, disposition, mime, length) -> openExternal(Uri.parse(url)));
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (selectedFiles != null) selectedFiles.onReceiveValue(null);
                selectedFiles = callback;
                try {
                    Intent picker = params.createIntent();
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                    startActivityForResult(picker, PICK_FILES);
                } catch (ActivityNotFoundException error) {
                    selectedFiles.onReceiveValue(null);
                    selectedFiles = null;
                }
                return true;
            }
        });
        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(Color.WHITE);
        TextView message = new TextView(this);
        message.setText("UniLink couldn’t reach your workspace.");
        message.setTextColor(Color.BLACK);
        errorView.addView(message);
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(v -> {
            errorView.setVisibility(android.view.View.GONE);
            web.loadUrl(retryUrl);
        });
        errorView.addView(retry);
        root.addView(errorView);
        errorView.setVisibility(android.view.View.GONE);
        if (state == null || web.restoreState(state) == null) web.loadUrl(START);
    }

    private static boolean isWorkspace(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void showRetry(Uri uri) {
        retryUrl = isWorkspace(uri) ? uri.toString() : START;
        errorView.setVisibility(android.view.View.VISIBLE);
    }

    private void openExternal(Uri uri) {
        if (!"https".equals(uri.getScheme()) && !"mailto".equals(uri.getScheme())) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != PICK_FILES || selectedFiles == null) return;
        Uri[] files = WebChromeClient.FileChooserParams.parseResult(result, data);
        if (result == RESULT_OK && data != null && data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            files = new Uri[count];
            for (int i = 0; i < count; i++) files[i] = data.getClipData().getItemAt(i).getUri();
        }
        selectedFiles.onReceiveValue(files);
        selectedFiles = null;
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        web.saveState(state);
    }

    @Override public void onBackPressed() {
        if (errorView.getVisibility() != android.view.View.VISIBLE && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (selectedFiles != null) selectedFiles.onReceiveValue(null);
        web.destroy();
        super.onDestroy();
    }
}
