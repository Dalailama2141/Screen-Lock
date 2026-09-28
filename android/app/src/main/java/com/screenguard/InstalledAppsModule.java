package com.screenguard;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.io.ByteArrayOutputStream;
import java.util.List;

public class InstalledAppsModule extends ReactContextBaseJavaModule {
    public InstalledAppsModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "InstalledApps";
    }

    @ReactMethod
    public void getInstalledApps(Promise promise) {
        try {
            PackageManager packageManager = getReactApplicationContext().getPackageManager();
            Intent launcherQuery = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolvedApps = packageManager.queryIntentActivities(launcherQuery, 0);
            resolvedApps.sort(Comparator.comparing(application -> application.loadLabel(packageManager).toString(), String.CASE_INSENSITIVE_ORDER));

            WritableArray result = Arguments.createArray();
            Set<String> seenPackages = new LinkedHashSet<>();

            for (ResolveInfo resolvedApp : resolvedApps) {
                ApplicationInfo applicationInfo = resolvedApp.activityInfo.applicationInfo;
                String packageName = applicationInfo.packageName;
                if (packageName.equals(getReactApplicationContext().getPackageName())) continue;
                if (!seenPackages.add(packageName)) continue;

                String appName = resolvedApp.loadLabel(packageManager) != null
                        ? resolvedApp.loadLabel(packageManager).toString()
                        : packageName;

                WritableMap app = Arguments.createMap();
                app.putString("name", appName);
                app.putString("packageName", packageName);

                Drawable icon = resolvedApp.loadIcon(packageManager);
                if (icon != null) {
                    app.putString("icon", getIconDataUri(icon));
                } else {
                    app.putString("icon", "");
                }
                result.pushMap(app);
            }

            promise.resolve(result);
        } catch (Exception error) {
            promise.reject("INSTALLED_APPS_ERROR", "Unable to query installed apps", error);
        }
    }

    private String getIconDataUri(Drawable drawable) {
        int size = 96;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(new Canvas(bitmap));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
        bitmap.recycle();
        return "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    }

    @ReactMethod
    public void launchApp(String packageName, Promise promise) {
        try {
            Intent launchIntent = getReactApplicationContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (launchIntent == null) {
                promise.reject("APP_NOT_FOUND", "Unable to find a launch activity for " + packageName);
                return;
            }
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(launchIntent);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("APP_LAUNCH_ERROR", "Unable to launch " + packageName, error);
        }
    }

    @ReactMethod
    public void isAppLockAccessibilityEnabled(Promise promise) {
        promise.resolve(AppLockStorage.isAccessibilityServiceEnabled(getReactApplicationContext()));
    }

    @ReactMethod
    public void openAppLockAccessibilitySettings(Promise promise) {
        try {
            Intent intent = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Intent detailsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_DETAILS_SETTINGS);
                detailsIntent.putExtra("android.extra.ComponentName", new ComponentName(getReactApplicationContext(), AppLockAccessibilityService.class));
                if (detailsIntent.resolveActivity(getReactApplicationContext().getPackageManager()) != null) {
                    intent = detailsIntent;
                }
            }
            if (intent == null) {
                intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("ACCESSIBILITY_SETTINGS_ERROR", "Unable to open accessibility settings", error);
        }
    }

    @ReactMethod
    public void setProtectedApps(ReadableArray packageNames, Promise promise) {
        try {
            Set<String> packages = new HashSet<>();
            for (int index = 0; index < packageNames.size(); index++) {
                String packageName = packageNames.getString(index);
                if (packageName != null && !packageName.isEmpty()) {
                    packages.add(packageName);
                }
            }
            AppLockStorage.setProtectedPackages(getReactApplicationContext(), packages);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("PROTECTED_APPS_ERROR", "Unable to save protected apps", error);
        }
    }

    @ReactMethod
    public void getProtectedApps(Promise promise) {
        try {
            WritableArray result = Arguments.createArray();
            for (String packageName : AppLockStorage.getProtectedPackages(getReactApplicationContext())) {
                result.pushString(packageName);
            }
            promise.resolve(result);
        } catch (Exception error) {
            promise.reject("PROTECTED_APPS_ERROR", "Unable to load protected apps", error);
        }
    }

    @ReactMethod
    public void consumePendingLockPackage(Promise promise) {
        promise.resolve(AppLockStorage.consumePendingPackage(getReactApplicationContext()));
    }

    @ReactMethod
    public void allowAppTemporarily(String packageName, double durationMs, Promise promise) {
        try {
            AppLockStorage.allowTemporarily(getReactApplicationContext(), packageName, Math.max(1000L, (long) durationMs));
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("TEMPORARY_UNLOCK_ERROR", "Unable to authorize app launch", error);
        }
    }
}
