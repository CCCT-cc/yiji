# 一记 release 混淆规则（R8 / ProGuard）
# 目标：在启用 minify 的同时，保留 Capacitor 原生桥接与 WebView JS 接口，避免运行时崩溃。

# Capacitor 核心（保留所有类与成员，桥接靠反射/动态调用）
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep interface com.capacitorjs.** { *; }

# WebView @JavascriptInterface 方法不可混淆/删除
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留带有 @PluginMethod 注解的插件方法（反射加载）
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# 保留 Parcelable / Serializable 实现（Intent 传递、状态恢复）
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
-keepclassmembers class * implements java.io.Serializable { *; }

# 保留注解与签名信息（插件反射需要）
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# 发布版移除 android.util.Log 的 v/d/i 输出，降低信息泄露
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
