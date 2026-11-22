package io.github.devmohammadsalameh.noor;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * The WebView both of Noor's screens use: the app itself (MainActivity) and the screensaver
 * (NoorDream). It shows the web app from this app's own files (assets/) under a made-up address,
 * https://noor.invalid/, so nothing is fetched to show it, and it never leaves those files.
 */
final class NoorWeb {
    static final String HOME = "https://noor.invalid/";

    private NoorWeb() {}

    /** host: the object the page sees as window.NoorHost. */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    static WebView make(final Context ctx, Object host) {
        WebView web = new WebView(ctx);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // where Noor keeps its settings
        s.setMediaPlaybackRequiresUserGesture(false);    // a remote press is not a "gesture" to a WebView
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        // The page's viewport tag is honoured (app.js sets it to the screen's own width for
        // Android) and the page scales its 1920x1080 stage to fit; pinch and focus zoom are off.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                              // the TV's font size setting must not bend the layout
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(host, "NoorHost");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (!url.startsWith(HOME)) return null;   // the weather, the city search, the recitations
                String path = r.getUrl().getPath();
                if (path == null || path.length() < 2) path = "/index.html";
                path = path.substring(1);
                try {
                    InputStream in = ctx.getAssets().open(path);
                    return new WebResourceResponse(mime(path), isText(path) ? "utf-8" : null, in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
                }
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !r.getUrl().toString().startsWith(HOME);   // the page never leaves its own files
            }
        });
        return web;
    }

    private static boolean isText(String p) {
        return p.endsWith(".html") || p.endsWith(".js") || p.endsWith(".css") || p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".txt");
    }
    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        return "text/plain";
    }
}
