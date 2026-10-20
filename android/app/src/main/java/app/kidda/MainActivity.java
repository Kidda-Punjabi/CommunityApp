package app.kidda;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // FirebaseInitProvider is in the manifest, but on this API 36 image it
        // does not initialise the default app before push registration. Do it here.
        FirebaseApp app = FirebaseApp.initializeApp(this);
        Log.i("Kidda", app == null ? "Firebase init returned null" : "Firebase init ok");
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
        createKiddaChannel();
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            String script = insetScript(bars.top / density, bars.bottom / density, bars.left / density, bars.right / density);
            webView.post(() -> webView.evaluateJavascript(script, null));
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    private void createKiddaChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            "kidda",
            "Kidda",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Class reminders and homework");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private static String insetScript(float top, float bottom, float left, float right) {
        return "(function(){"
            + "var probe=document.createElement('div');"
            + "probe.style.cssText='position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);';"
            + "document.documentElement.appendChild(probe);"
            + "var cs=getComputedStyle(probe);"
            + "function n(v){return parseFloat(v)||0;}"
            + "var top=n(cs.paddingTop),bottom=n(cs.paddingBottom),left=n(cs.paddingLeft),right=n(cs.paddingRight);"
            + "probe.remove();"
            + "var root=document.documentElement;var injected=false;"
            + "if(top===0){root.style.setProperty('--kidda-sat','" + top + "px');injected=true;}"
            + "if(bottom===0){root.style.setProperty('--kidda-sab','" + bottom + "px');injected=true;}"
            + "if(left===0){root.style.setProperty('--kidda-sal','" + left + "px');injected=true;}"
            + "if(right===0){root.style.setProperty('--kidda-sar','" + right + "px');injected=true;}"
            + "if(injected)root.classList.add('kidda-android-insets');"
            + "})();";
    }
}
