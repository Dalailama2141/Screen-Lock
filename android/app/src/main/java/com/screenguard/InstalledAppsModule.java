package com.screenguard;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
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

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class InstalledAppsModule extends ReactContextBaseJavaModule {
    private static final long DAY_MS = 86400000L;
    private static final ExecutorService usageExecutor = Executors.newSingleThreadExecutor();

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
    public void getAppLockPermissionStatus(Promise promise) {
        try {
            WritableMap status = Arguments.createMap();
            status.putBoolean("overlay", AppLockStorage.canDrawOverlays(getReactApplicationContext()));
            status.putBoolean("usageAccess", AppLockStorage.hasUsageAccess(getReactApplicationContext()));
            status.putBoolean("protectionActive", AppLockStorage.isProtectionActive());
            promise.resolve(status);
        } catch (Exception error) {
            promise.reject("PERMISSION_STATUS_ERROR", "Unable to read app lock permission status", error);
        }
    }

    @ReactMethod
    public void openOverlaySettings(Promise promise) {
        try {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getReactApplicationContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("OVERLAY_SETTINGS_ERROR", "Unable to open display over other apps settings", error);
        }
    }

    @ReactMethod
    public void openUsageAccessSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("USAGE_SETTINGS_ERROR", "Unable to open usage access settings", error);
        }
    }

    @ReactMethod
    public void startAppLockProtection(Promise promise) {
        try {
            if (!AppLockStorage.canDrawOverlays(getReactApplicationContext())) {
                promise.reject("OVERLAY_PERMISSION_REQUIRED", "Display over other apps permission is required");
                return;
            }
            if (!AppLockStorage.hasUsageAccess(getReactApplicationContext())) {
                promise.reject("USAGE_ACCESS_REQUIRED", "Usage access permission is required");
                return;
            }
            Intent intent = new Intent(getReactApplicationContext(), AppLockMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getReactApplicationContext().startForegroundService(intent);
            } else {
                getReactApplicationContext().startService(intent);
            }
            AppLockStorage.setProtectionEnabled(getReactApplicationContext(), true);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("PROTECTION_START_ERROR", "Unable to start app protection", error);
        }
    }

    @ReactMethod
    public void stopAppLockProtection(Promise promise) {
        try {
            Intent intent = new Intent(getReactApplicationContext(), AppLockMonitorService.class);
            getReactApplicationContext().stopService(intent);
            AppLockStorage.setProtectionEnabled(getReactApplicationContext(), false);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("PROTECTION_STOP_ERROR", "Unable to stop app protection", error);
        }
    }

    @ReactMethod
    public void hideLockOverlay(Promise promise) {
        AppLockMonitorService.hideOverlay();
        promise.resolve(null);
    }

    @ReactMethod
    public void dismissLockOverlay(Promise promise) {
        AppLockMonitorService.dismissAndGoHome(getReactApplicationContext());
        promise.resolve(null);
    }

    @ReactMethod
    public void openProtectedApp(String packageName, double durationMs, Promise promise) {
        try {
            AppLockMonitorService.allowAndLaunch(
                    getReactApplicationContext(),
                    packageName,
                    Math.max(1000L, (long) durationMs)
            );
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("PROTECTED_APP_LAUNCH_ERROR", "Unable to open the protected app", error);
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

    private static void addUsageInterval(Map<String, long[]> totals, String packageName, long start, long end, long rangeStart, int dayCount) {
        if (end <= start) return;
        long cursor = Math.max(start, rangeStart);
        long boundedEnd = end;
        while (cursor < boundedEnd) {
            int dayIndex = (int) ((cursor - rangeStart) / DAY_MS);
            if (dayIndex < 0 || dayIndex >= dayCount) break;
            long dayEnd = rangeStart + ((long) (dayIndex + 1) * DAY_MS);
            long segmentEnd = Math.min(boundedEnd, dayEnd);
            long[] daily = totals.get(packageName);
            if (daily != null) daily[dayIndex] += Math.max(0L, segmentEnd - cursor);
            cursor = segmentEnd;
        }
    }

    @ReactMethod
    public void getAppUsage(double days, Promise promise) {
        usageExecutor.execute(() -> {
            try {
                int dayCount = (int) Math.max(1, Math.min(30, days));
                UsageStatsManager usageStatsManager = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
                WritableArray result = Arguments.createArray();
                if (usageStatsManager == null || !AppLockStorage.hasUsageAccess(getReactApplicationContext())) {
                    promise.resolve(result);
                    return;
                }

                Calendar calendar = Calendar.getInstance();
                calendar.set(Calendar.HOUR_OF_DAY, 0);
                calendar.set(Calendar.MINUTE, 0);
                calendar.set(Calendar.SECOND, 0);
                calendar.set(Calendar.MILLISECOND, 0);
                long rangeEnd = System.currentTimeMillis();
                long rangeStart = calendar.getTimeInMillis() - ((long) (dayCount - 1) * DAY_MS);

                Map<String, long[]> totals = new HashMap<>();
                Map<String, Long> resumedAt = new HashMap<>();
                Set<String> trackedPackages = new HashSet<>();

                int resumedType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? UsageEvents.Event.ACTIVITY_RESUMED
                        : UsageEvents.Event.MOVE_TO_FOREGROUND;
                int pausedType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? UsageEvents.Event.ACTIVITY_PAUSED
                        : UsageEvents.Event.MOVE_TO_BACKGROUND;

                UsageEvents.Event event = new UsageEvents.Event();
                UsageEvents usageEvents = usageStatsManager.queryEvents(rangeStart, rangeEnd);
                while (usageEvents.hasNextEvent()) {
                    usageEvents.getNextEvent(event);
                    String packageName = event.getPackageName() == null ? null : event.getPackageName().toString();
                    if (packageName == null) continue;
                    if (!trackedPackages.contains(packageName)) {
                        trackedPackages.add(packageName);
                        totals.put(packageName, new long[dayCount]);
                    }

                    if (event.getEventType() == resumedType) {
                        resumedAt.put(packageName, event.getTimeStamp());
                    } else if (event.getEventType() == pausedType) {
                        Long startedAt = resumedAt.remove(packageName);
                        if (startedAt != null) {
                            addUsageInterval(totals, packageName, startedAt, event.getTimeStamp(), rangeStart, dayCount);
                        }
                    }
                }

                for (Map.Entry<String, Long> entry : resumedAt.entrySet()) {
                    addUsageInterval(totals, entry.getKey(), entry.getValue(), rangeEnd, rangeStart, dayCount);
                }

                List<String> sortedPackages = new ArrayList<>(trackedPackages);
                sortedPackages.sort(Comparator.comparingLong((String packageName) -> {
                    long[] values = totals.get(packageName);
                    long sum = 0;
                    if (values != null) for (long value : values) sum += value;
                    return sum;
                }).reversed());

                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                for (String packageName : sortedPackages) {
                    long[] values = totals.get(packageName);
                    WritableMap appUsage = Arguments.createMap();
                    appUsage.putString("packageName", packageName);
                    long totalMillis = 0;
                    WritableArray daily = Arguments.createArray();
                    for (int dayIndex = 0; dayIndex < dayCount; dayIndex++) {
                        long value = values == null ? 0L : values[dayIndex];
                        totalMillis += value;
                        WritableMap day = Arguments.createMap();
                        day.putString("date", dateFormat.format(new Date(rangeStart + ((long) dayIndex * DAY_MS))));
                        day.putDouble("millis", value);
                        daily.pushMap(day);
                    }
                    appUsage.putDouble("totalMillis", totalMillis);
                    appUsage.putArray("daily", daily);
                    result.pushMap(appUsage);
                }

                promise.resolve(result);
            } catch (Exception error) {
                promise.reject("USAGE_STATS_ERROR", "Unable to read app usage statistics", error);
            }
        });
    }

    @ReactMethod
    public void clearSessionUnlock(Promise promise) {
        AppLockStorage.clearLockSession(getReactApplicationContext());
        promise.resolve(null);
    }

    @ReactMethod
    public void getAppIcon(String packageName, Promise promise) {
        try {
            Drawable icon = getReactApplicationContext().getPackageManager().getApplicationIcon(packageName);
            promise.resolve(getIconDataUri(icon));
        } catch (Exception error) {
            promise.resolve("");
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
