import type { CapacitorConfig } from "@capacitor/cli";

// The same static export Vercel serves (out/), bundled into the iOS and Android apps. Data stays live from Convex.
const config: CapacitorConfig = {
  appId: "com.csprinkels.kilo",
  appName: "Kilo",
  webDir: "out",
  // https on Android so localStorage/geolocation behave as on the web; iOS keeps capacitor://localhost.
  server: { androidScheme: "https" },
  ios: { contentInset: "never", scrollEnabled: true },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: "#efe8dc", showSpinner: false },
    StatusBar: { overlaysWebView: true, style: "DEFAULT" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
