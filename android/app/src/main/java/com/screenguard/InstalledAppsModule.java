package com.screenguard;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> activities = packageManager.queryIntentActivities(launcherIntent, 0);
            Set<String> packages = new HashSet<>();
            WritableArray result = Arguments.createArray();

            for (ResolveInfo resolveInfo : activities) {
                ApplicationInfo applicationInfo = resolveInfo.activityInfo.applicationInfo;
                String packageName = applicationInfo.packageName;
                if (!packages.add(packageName)) continue;

                WritableMap app = Arguments.createMap();
                app.putString("name", packageManager.getApplicationLabel(applicationInfo).toString());
                app.putString("packageName", packageName);
                result.pushMap(app);
            }

            promise.resolve(result);
        } catch (Exception error) {
            promise.reject("INSTALLED_APPS_ERROR", "Unable to query installed apps", error);
        }
    }
}
