package com.screenguard;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;

public class AppLockAccessibilityService extends AccessibilityService {
    public static final String EXTRA_LOCKED_PACKAGE = "com.screenguard.extra.LOCKED_PACKAGE";

    private String lastInterceptedPackage = "";
    private long lastInterceptedAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;

        String packageName = event.getPackageName() == null ? "" : event.getPackageName().toString();
        if (packageName.isEmpty() || packageName.equals(getPackageName())) return;
        if (!AppLockStorage.isProtected(this, packageName)) return;
        if (AppLockStorage.isTemporarilyUnlocked(this, packageName)) return;

        long now = System.currentTimeMillis();
        if (packageName.equals(lastInterceptedPackage) && now - lastInterceptedAt < 1200L) return;
        lastInterceptedPackage = packageName;
        lastInterceptedAt = now;

        performGlobalAction(GLOBAL_ACTION_HOME);
        AppLockStorage.setPendingPackage(this, packageName);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        intent.putExtra(EXTRA_LOCKED_PACKAGE, packageName);
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
    }
}
