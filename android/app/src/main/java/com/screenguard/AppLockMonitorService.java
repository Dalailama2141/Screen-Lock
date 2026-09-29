package com.screenguard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.PorterDuff;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.lang.ref.WeakReference;

public class AppLockMonitorService extends Service {
    private static final String CHANNEL_ID = "screen_guard_app_lock";
    private static final int NOTIFICATION_ID = 4711;
    private static final long POLL_INTERVAL_MS = 600L;

    private static volatile boolean running = false;
    private static WeakReference<AppLockMonitorService> instanceRef = new WeakReference<>(null);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View overlayView;
    private String overlayPackage;
    private long overlayShownAt = 0L;
    private String lastInterceptedPackage = "";
    private long lastInterceptedAt = 0L;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            pollForegroundApp();
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    static boolean isRunning() {
        return running;
    }

    static void hideOverlay() {
        AppLockMonitorService service = instanceRef.get();
        if (service != null) service.removeOverlay();
    }

    static void dismissAndGoHome(Context context) {
        hideOverlay();
        AppLockStorage.setSessionUnlocked(context, false);
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(homeIntent);
    }

    static void allowAndLaunch(Context context, String packageName, long durationMs) {
        AppLockStorage.allowTemporarily(context, packageName, Math.max(1000L, durationMs));
        AppLockStorage.setSessionUnlocked(context, true);
        hideOverlay();
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(packageName);
        if (launchIntent == null) {
            dismissAndGoHome(context);
            return;
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(launchIntent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        instanceRef = new WeakReference<>(this);
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        createNotificationChannel();
        startForegroundNotification();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        handler.removeCallbacks(pollRunnable);
        handler.post(pollRunnable);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacks(pollRunnable);
        removeOverlay();
        instanceRef = new WeakReference<>(null);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.app_lock_notification_channel),
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.app_lock_notification_text));
        manager.createNotificationChannel(channel);
    }

    private void startForegroundNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.app_lock_notification_title))
                .setContentText(getString(R.string.app_lock_notification_text))
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void pollForegroundApp() {
        if (overlayView != null) {
            if (System.currentTimeMillis() - overlayShownAt > 30000L) {
                dismissAndGoHome(this);
            }
            return;
        }
        if (!AppLockStorage.hasUsageAccess(this)) return;
        if (AppLockStorage.isSessionUnlocked(this)) return;

        String foregroundPackage = getForegroundPackage();
        if (foregroundPackage == null || foregroundPackage.equals(getPackageName())) return;
        if (!AppLockStorage.isProtected(this, foregroundPackage)) return;
        if (AppLockStorage.isTemporarilyUnlocked(this, foregroundPackage)) return;

        long now = System.currentTimeMillis();
        if (foregroundPackage.equals(lastInterceptedPackage) && now - lastInterceptedAt < 1500L) return;
        lastInterceptedPackage = foregroundPackage;
        lastInterceptedAt = now;

        showOverlay(foregroundPackage);
        AppLockStorage.setPendingPackage(this, foregroundPackage);

        Intent lockIntent = new Intent(this, MainActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        lockIntent.putExtra(AppLockMonitorService.EXTRA_LOCKED_PACKAGE, foregroundPackage);
        startActivity(lockIntent);
    }

    private String getForegroundPackage() {
        UsageStatsManager usageStatsManager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) return null;

        long now = System.currentTimeMillis();
        UsageEvents.Event event = new UsageEvents.Event();
        UsageEvents usageEvents = usageStatsManager.queryEvents(now - 5000L, now);
        String foregroundPackage = null;
        int foregroundType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? UsageEvents.Event.ACTIVITY_RESUMED
                : UsageEvents.Event.MOVE_TO_FOREGROUND;

        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            if (event.getEventType() == foregroundType && event.getPackageName() != null) {
                foregroundPackage = event.getPackageName().toString();
            }
        }
        return foregroundPackage;
    }

    private void showOverlay(String packageName) {
        if (overlayView != null || !AppLockStorage.canDrawOverlays(this)) return;

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER);
        overlay.setBackgroundColor(Color.rgb(2, 11, 27));

        ProgressBar loader = new ProgressBar(this);
        loader.setIndeterminate(true);
        if (loader.getIndeterminateDrawable() != null) {
            loader.getIndeterminateDrawable().setColorFilter(Color.rgb(38, 228, 213), PorterDuff.Mode.SRC_IN);
        }
        LinearLayout.LayoutParams loaderParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        loaderParams.bottomMargin = 28;
        overlay.addView(loader, loaderParams);

        TextView message = new TextView(this);
        message.setText("Screen Guard\nVerifying app lock…");
        message.setTextColor(Color.WHITE);
        message.setTextSize(18);
        message.setGravity(Gravity.CENTER);
        message.setPadding(32, 32, 32, 32);
        overlay.addView(message, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        ));

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );

        try {
            windowManager.addView(overlay, params);
            overlayView = overlay;
            overlayPackage = packageName;
            overlayShownAt = System.currentTimeMillis();
        } catch (Exception ignored) {
            overlayView = null;
            overlayPackage = null;
        }
    }

    private void removeOverlay() {
        if (overlayView == null || windowManager == null) return;
        try {
            windowManager.removeView(overlayView);
        } catch (Exception ignored) {
        }
        overlayView = null;
        overlayPackage = null;
    }

    static String getOverlayPackage() {
        AppLockMonitorService service = instanceRef.get();
        return service == null ? null : service.overlayPackage;
    }

    public static final String EXTRA_LOCKED_PACKAGE = "com.screenguard.extra.LOCKED_PACKAGE";
}
