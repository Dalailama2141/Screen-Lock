package com.screenguard;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.Comparator;
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
            List<ApplicationInfo> applications = packageManager.getInstalledApplications(PackageManager.GET_META_DATA);
            WritableArray result = Arguments.createArray();
            applications.sort(Comparator.comparing(application -> packageManager.getApplicationLabel(application).toString(), String.CASE_INSENSITIVE_ORDER));

            for (ApplicationInfo applicationInfo : applications) {
                String packageName = applicationInfo.packageName;
                if (packageName.equals(getReactApplicationContext().getPackageName())) continue;
                Intent launchIntent = packageManager.getLaunchIntentForPackage(packageName);
                if (launchIntent == null) continue;

                String appName = packageManager.getApplicationLabel(applicationInfo) != null
                        ? packageManager.getApplicationLabel(applicationInfo).toString()
                        : packageName;

                WritableMap app = Arguments.createMap();
                app.putString("name", appName);
                app.putString("packageName", packageName);

                Drawable icon = applicationInfo.loadIcon(packageManager);
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
}
