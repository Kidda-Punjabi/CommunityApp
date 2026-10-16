import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";
import { Style } from "@capacitor/status-bar";

const config: CapacitorConfig = {
  appId: "app.kidda",
  appName: "Kidda",
  webDir: "capacitor-shell",
  server: {
    url: "https://webapp.kidda.app",
    allowNavigation: ["webapp.kidda.app", "pztubczhqkzcwtkstpgi.supabase.co"],
  },
  ios: {
    appendUserAgent: "KiddaApp/1.0",
    contentInset: "never",
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: "#ffffff",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
      launchFadeOutDuration: 200,
    },
    StatusBar: {
      // Style.Light is dark text and icons on a light background.
      style: Style.Light,
      backgroundColor: "#fafafa",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Light,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
