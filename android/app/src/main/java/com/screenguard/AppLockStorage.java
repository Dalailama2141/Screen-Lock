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
    private static final String KEY_ACCENT_COLOR = "accent_color";
    private static final String KEY_SESSION_UNLOCKED = "session_unlocked";
    private static final String KEY_SESSION_PACKAGE = "session_package";
    private static final String KEY_SESSION_STARTED_AT = "session_started_at";
    private static final String TEMPORARY_UNLOCK_PREFIX = "temporary_unlock_";
    private static final long SESSION_TTL_MS = 120000L;

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

    static void beginSession(Context context, String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            clearLockSession(context);
            return;
        }
        preferences(context).edit()
                .putBoolean(KEY_SESSION_UNLOCKED, true)
                .putString(KEY_SESSION_PACKAGE, packageName)
                .putLong(KEY_SESSION_STARTED_AT, System.currentTimeMillis())
                .apply();
    }

    /**
     * A session only suppresses the lock for the exact app it was granted for, and only
     * while it is fresh. Without this, a session started by one unlock silently disabled
     * protection for every other app until something explicitly cleared it.
     */
    static boolean isSessionUnlockedFor(Context context, String packageName) {
        SharedPreferences preferences = preferences(context);
        if (!preferences.getBoolean(KEY_SESSION_UNLOCKED, false)) return false;

        long startedAt = preferences.getLong(KEY_SESSION_STARTED_AT, 0L);
        String sessionPackage = preferences.getString(KEY_SESSION_PACKAGE, null);
        if (startedAt <= 0L || sessionPackage == null || !sessionPackage.equals(packageName)) return false;
        if (System.currentTimeMillis() - startedAt > SESSION_TTL_MS) {
            clearLockSession(context);
            return false;
        }
        return true;
    }

    /** Drops the unlock session plus every temporary grant. Used on close, reset and setup. */
    static void clearLockSession(Context context) {
        SharedPreferences preferences = preferences(context);
        SharedPreferences.Editor editor = preferences.edit()
                .remove(KEY_SESSION_UNLOCKED)
                .remove(KEY_SESSION_PACKAGE)
                .remove(KEY_SESSION_STARTED_AT);
        for (String key : preferences.getAll().keySet()) {
            if (key.startsWith(TEMPORARY_UNLOCK_PREFIX)) editor.remove(key);
        }
        editor.apply();
    }

    static void setProtectionEnabled(Context context, boolean enabled) {
        preferences(context).edit().putBoolean(KEY_PROTECTION_ENABLED, enabled).apply();
    }

    static boolean isProtectionEnabled(Context context) {
        return preferences(context).getBoolean(KEY_PROTECTION_ENABLED, false);
    }

    private static final int DEFAULT_ACCENT_COLOR = 0xFF020B1B;

    /**
     * Background colour for the native lock overlay, mirrored from the JS accent selection so the
     * overlay drawn over a third-party app matches the colour chosen in Settings.
     */
    static int getAccentColor(Context context) {
        return preferences(context).getInt(KEY_ACCENT_COLOR, DEFAULT_ACCENT_COLOR);
    }

    static void setAccentColor(Context context, int color) {
        preferences(context).edit().putInt(KEY_ACCENT_COLOR, color).apply();
    }
}
