# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native / Hermes / FBJNI
-keep class com.facebook.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# Gesture Handler / Reanimated / Screens
-keep class com.swmansion.gesture.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.**

# SVG
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# Slider
-keep class com.reactnativecommunity.slider.** { *; }
-dontwarn com.reactnativecommunity.slider.**

# Image picker / documents picker
-keep class com.imagepicker.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }
-dontwarn com.imagepicker.**
-dontwarn com.reactnativedocumentpicker.**

# JAXB and Java Activation Framework - ignore missing AWT classes on Android
-dontwarn javax.xml.bind.**
-dontwarn org.glassfish.jaxb.**
-dontwarn javax.activation.**
-dontwarn java.awt.datatransfer.Transferable
-dontwarn java.awt.datatransfer.DataFlavor
-dontwarn java.awt.datatransfer.**
-dontwarn java.beans.Beans
-dontwarn java.beans.**