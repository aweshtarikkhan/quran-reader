import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quran.reader",
  appName: "Quran Reader",
  webDir: "www",
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#f7f3ea"
    }
  }
};

export default config;