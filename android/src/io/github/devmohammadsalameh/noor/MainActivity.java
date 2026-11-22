package io.github.devmohammadsalameh.noor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * Noor on Android TV, Google TV and Fire TV.
 *
 * The whole app is the same web page as on a Samsung TV, read from this app's own files
 * (assets/) under a made-up address, https://noor.invalid/, so nothing is fetched to show it.
 * This class does three small jobs for the page:
 *   - it turns the remote's buttons into the key numbers the page already knows (window.NoorKey);
 *   - it gives the page a few things only Android can do (window.NoorHost): leave the app,
 *     show the TV's keyboard, keep the TV awake;
 *   - it keeps the page from ever leaving its own files.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://noor.invalid/";
    private WebView web;
    private volatile boolean typing = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
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
        web.addJavascriptInterface(new Host(), "NoorHost");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (!url.startsWith(HOME)) return null;   // the weather, the city search, the recitations
                String path = r.getUrl().getPath();
                if (path == null || path.length() < 2) path = "/index.html";
                path = path.substring(1);
                try {
                    InputStream in = getAssets().open(path);
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
        setContentView(web);
        hideBars();
        web.requestFocus();
        if (saved == null) web.loadUrl(HOME + "index.html");
        else web.restoreState(saved);
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

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) hideBars();
    }

    /** What the page can ask of Android. Each call comes in on a WebView thread. */
    private final class Host {
        @JavascriptInterface public String platform() { return "android"; }
        @JavascriptInterface public void exit() {
            runOnUiThread(new Runnable() { public void run() { moveTaskToBack(true); } });
        }
        @JavascriptInterface public void typing(final boolean on) {
            typing = on;
            runOnUiThread(new Runnable() { public void run() {
                InputMethodManager im = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (im == null) return;
                if (on) { web.requestFocus(); im.showSoftInput(web, InputMethodManager.SHOW_IMPLICIT); }
                else { im.hideSoftInputFromWindow(web.getWindowToken(), 0); hideBars(); }
            } });
        }
        @JavascriptInterface public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() { public void run() {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } });
        }
    }

    /** The key number the page uses for a remote button (the Samsung numbers), or 0 to leave it to Android. */
    private static int pageKey(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_LEFT: return 37;
            case KeyEvent.KEYCODE_DPAD_UP: return 38;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 39;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 40;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A: return 13;
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE:
            case KeyEvent.KEYCODE_BUTTON_B: return 27;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return 10252;
            case KeyEvent.KEYCODE_MEDIA_PLAY: return 415;
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return 19;
            case KeyEvent.KEYCODE_MEDIA_STOP: return 413;
            case KeyEvent.KEYCODE_MEDIA_NEXT: return 10233;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: return 10232;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: return 417;
            case KeyEvent.KEYCODE_MEDIA_REWIND: return 412;
            case KeyEvent.KEYCODE_PROG_RED: return 403;
            case KeyEvent.KEYCODE_PROG_GREEN: return 404;
            case KeyEvent.KEYCODE_PROG_YELLOW:
            case KeyEvent.KEYCODE_MENU: return 405;       // Fire TV's menu button: favourite
            case KeyEvent.KEYCODE_PROG_BLUE: return 406;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP: return 427;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN: return 428;
            // Remotes with no colour buttons (most Google TV and Fire TV remotes), and a keyboard:
            // the letters the page already takes as stand-ins.
            case KeyEvent.KEYCODE_Y: return 89;   // yellow: favourite / only this photo
            case KeyEvent.KEYCODE_G: return 71;   // green: favourites only / all photos
            case KeyEvent.KEYCODE_R: return 82;   // red: reciter
            case KeyEvent.KEYCODE_B: return 66;   // blue: after a surah
            case KeyEvent.KEYCODE_N: return 78;   // next surah
            case KeyEvent.KEYCODE_P: return 80;   // previous surah
            default: return 0;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        // While a place name is being typed the keyboard's keys go to the page as they are;
        // only Back is ours, to close the box.
        if (typing && code != KeyEvent.KEYCODE_BACK && code != KeyEvent.KEYCODE_ESCAPE) return super.dispatchKeyEvent(e);
        final int k = pageKey(code);
        if (k == 0) return super.dispatchKeyEvent(e);    // volume, power, home, voice: Android's
        // A held arrow repeats, to run down a long list; a held OK or Back counts once.
        boolean arrow = k >= 37 && k <= 40;
        if (e.getAction() == KeyEvent.ACTION_DOWN && (arrow || e.getRepeatCount() == 0))
            web.evaluateJavascript("window.NoorKey&&NoorKey(" + k + ")", null);
        return true;
    }

    @Override protected void onResume() { super.onResume(); web.onResume(); web.resumeTimers(); hideBars(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
