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

# ─── expo-modules-core (Kotlin internals stripped by R8) ─────────────────────
-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-dontwarn expo.modules.**

# ─── JSI / Hermes / JNI (React Native core) ──────────────────────────────────
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepattributes *Annotation*
-keepattributes JavascriptInterface
`;

const withNativeModuleProguard = (config) => {
  // Step 1: Write proguard keep rules
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const root = config.modRequest.platformProjectRoot;

      // Write proguard rules
      const proguardPath = path.join(root, 'app', 'proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes('com.tencent.mmkv')) {
          fs.appendFileSync(proguardPath, NATIVE_MODULE_RULES);
        }
      }

      // Step 2: Disable minification entirely in release build.
      // Native modules (MMKV, maps, webview) crash at startup when R8
      // strips their JNI bridge classes, even with keep rules.
      // Handle both Groovy (build.gradle) and Kotlin DSL (build.gradle.kts).
      const groovy = path.join(root, 'app', 'build.gradle');
      const kotlin = path.join(root, 'app', 'build.gradle.kts');

      if (fs.existsSync(groovy)) {
        let src = fs.readFileSync(groovy, 'utf8');
        src = src.replace(/minifyEnabled\s+\S+/g, 'minifyEnabled false');
        fs.writeFileSync(groovy, src);
      } else if (fs.existsSync(kotlin)) {
        let src = fs.readFileSync(kotlin, 'utf8');
        src = src.replace(/isMinifyEnabled\s*=\s*\S+/g, 'isMinifyEnabled = false');
        src = src.replace(/minifyEnabled\s*=?\s*\S+/g, 'minifyEnabled false');
        fs.writeFileSync(kotlin, src);
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withNativeModuleProguard;
