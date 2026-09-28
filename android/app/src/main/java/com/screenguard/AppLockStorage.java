package com.screenguard;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;

import java.util.HashSet;
import java.util.Set;

final class AppLockStorage {
    private static final String PREFERENCES_NAME = "screen_guard_app_lock";
    private static final String KEY_PROTECTED_PACKAGES = "protected_packages";
    private static final String KEY_PENDING_PACKAGE = "pending_package";
    private static final String KEY_PROTECTION_ENABLED = "protection_enabled";
    private static final String KEY_SESSION_UNLOCKED = "session_unlocked";
    private static final String TEMPORARY_UNLOCK_PREFIX = "temporary_unlock_";

    private AppLockStorage() {
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    static Set<String> getProtectedPackages(Context context) {
        Set<String> stored = preferences(context).getStringSet(KEY_PROTECTED_PACKAGES, new HashSet<>());
        return stored == null ? new HashSet<>() : new HashSet<>(stored);
    }

    static void setProtectedPackages(Context context, Set<String> packageNames) {
        preferences(context).edit()
                .putStringSet(KEY_PROTECTED_PACKAGES, new HashSet<>(packageNames))
                .apply();
    }

    static boolean isProtected(Context context, String packageName) {
        return getProtectedPackages(context).contains(packageName);
    }

    static void setPendingPackage(Context context, String packageName) {
        SharedPreferences.Editor editor = preferences(context).edit();
        if (TextUtils.isEmpty(packageName)) {
            editor.remove(KEY_PENDING_PACKAGE);
        } else {
            editor.putString(KEY_PENDING_PACKAGE, packageName);
        }
        editor.apply();
    }

    static String consumePendingPackage(Context context) {
        SharedPreferences preferences = preferences(context);
        String packageName = preferences.getString(KEY_PENDING_PACKAGE, null);
        if (packageName != null) {
            preferences.edit().remove(KEY_PENDING_PACKAGE).apply();
        }
        return packageName;
    }

    static void allowTemporarily(Context context, String packageName, long durationMs) {
        preferences(context).edit()
                .putLong(TEMPORARY_UNLOCK_PREFIX + packageName, System.currentTimeMillis() + durationMs)
                .apply();
    }

    static boolean isTemporarilyUnlocked(Context context, String packageName) {
        SharedPreferences preferences = preferences(context);
        String key = TEMPORARY_UNLOCK_PREFIX + packageName;
        long expiresAt = preferences.getLong(key, 0L);
        if (expiresAt <= System.currentTimeMillis()) {
            preferences.edit().remove(key).apply();
            return false;
        }
        return true;
    }

    static boolean canDrawOverlays(Context context) {
        return Settings.canDrawOverlays(context);
    }

    static boolean hasUsageAccess(Context context) {
        AppOpsManager appOpsManager = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (appOpsManager == null) return false;
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = appOpsManager.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.getPackageName()
            );
        } else {
            mode = appOpsManager.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.getPackageName()
            );
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    static boolean isProtectionActive() {
        return AppLockMonitorService.isRunning();
    }

    static void setSessionUnlocked(Context context, boolean unlocked) {
        preferences(context).edit().putBoolean(KEY_SESSION_UNLOCKED, unlocked).apply();
    }

    static boolean isSessionUnlocked(Context context) {
        return preferences(context).getBoolean(KEY_SESSION_UNLOCKED, false);
    }

    static void setProtectionEnabled(Context context, boolean enabled) {
        preferences(context).edit().putBoolean(KEY_PROTECTION_ENABLED, enabled).apply();
    }

    static boolean isProtectionEnabled(Context context) {
        return preferences(context).getBoolean(KEY_PROTECTION_ENABLED, false);
    }
}
