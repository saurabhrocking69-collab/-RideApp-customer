const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NATIVE_MODULE_RULES = `
# ─── Razorpay ───────────────────────────────────────────────────────────────
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclasseswithmembers class * {
    public void onPayment*(...);
}
-optimizations !method/inlining/*

# ─── MMKV ────────────────────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }
-keepclassmembers class com.tencent.mmkv.MMKV { native <methods>; }
-dontwarn com.tencent.mmkv.**

# ─── react-native-maps ───────────────────────────────────────────────────────
-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.airbnb.android.react.maps.**

# ─── react-native-webview ────────────────────────────────────────────────────
-keep class com.reactnativecommunity.webview.** { *; }
-dontwarn com.reactnativecommunity.webview.**

# ─── expo-notifications / Firebase Messaging ─────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── JSI / Hermes / JNI (React Native core) ──────────────────────────────────
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepattributes *Annotation*
-keepattributes JavascriptInterface
`;

const withNativeModuleProguard = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes('com.tencent.mmkv')) {
          fs.appendFileSync(proguardPath, NATIVE_MODULE_RULES);
        }
      }
      return config;
    },
  ]);
};

module.exports = withNativeModuleProguard;
