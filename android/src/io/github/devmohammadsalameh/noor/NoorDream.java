package io.github.devmohammadsalameh.noor;

import android.content.Intent;
import android.service.dreams.DreamService;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Noor as the TV's screensaver ("Daydream" in Android's words). When the TV has been idle for the
 * time set in its own settings, Android starts this and Noor's home comes up by itself: the
 * clock, the prayer times, the photo. There is nothing to press in it. OK opens Noor itself;
 * any other button goes back to what was on before.
 *
 * It is the same page as the app, opened with ?dream=1, and it reads the same settings.
 */
public class NoorDream extends DreamService {
    private WebView web;

    /** The page gets the same NoorHost, with nothing behind it that a screensaver should do. */
    private static final class Host {
        @JavascriptInterface public String platform() { return "android"; }
        @JavascriptInterface public void exit() {}
        @JavascriptInterface public void typing(boolean on) {}
        @JavascriptInterface public void keepAwake(boolean on) {}
        @JavascriptInterface public boolean dreamSettings() { return false; }
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(true);     // so the remote's OK can be told from its other buttons
        setFullscreen(true);
        setScreenBright(true);
        web = NoorWeb.make(this, new Host());
        setContentView(web);
        web.loadUrl(NoorWeb.HOME + "index.html?dream=1");
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() != KeyEvent.ACTION_DOWN) return true;
        int code = e.getKeyCode();
        if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_BUTTON_A) {
            try { startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (RuntimeException ex) { /* Android said no: just wake */ }
        }
        finish();
        return true;
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        super.onDetachedFromWindow();
    }
}
