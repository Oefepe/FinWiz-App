package com.finwiz.notificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FinWizNotificationListenerModule : Module() {

  companion object {
    @Volatile private var instance: FinWizNotificationListenerModule? = null
    // True only while JS has at least one onNotification subscriber.
    @Volatile private var observing = false

    /**
     * Forwards a notification to JS. Returns false when nobody is listening
     * (React context gone or no subscription yet) so the service can queue it.
     */
    fun emitNotification(appPackage: String, title: String, body: String, timestamp: Long): Boolean {
      val module = instance ?: return false
      if (!observing) return false
      module.sendEvent(
        "onNotification",
        mapOf(
          "appPackage" to appPackage,
          "title" to title,
          "body" to body,
          "timestamp" to timestamp.toDouble(),
        ),
      )
      return true
    }
  }

  private val context: Context?
    get() = appContext.reactContext

  private fun isPermissionGranted(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")
    val component =
      ComponentName(ctx, FinWizNotificationListenerService::class.java).flattenToString()
    return flat?.contains(component) == true
  }

  override fun definition() = ModuleDefinition {
    Name("FinWizNotificationListener")

    Events("onNotification")

    OnCreate {
      instance = this@FinWizNotificationListenerModule
    }

    OnDestroy {
      if (instance === this@FinWizNotificationListenerModule) {
        instance = null
        observing = false
      }
    }

    OnStartObserving {
      observing = true
    }

    OnStopObserving {
      observing = false
    }

    Function("isPermissionGranted") {
      val ctx = context ?: return@Function false
      isPermissionGranted(ctx)
    }

    Function("openPermissionSettings") {
      val ctx = context ?: return@Function Unit
      ctx.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("startListening") { packages: List<String> ->
      val ctx = context ?: return@Function false
      ListenerStore.start(ctx, packages)
      if (!isPermissionGranted(ctx)) return@Function false
      // Ask the system to (re)connect the service — it can stay unbound
      // after an app update or OEM battery-saver kill until rebound.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        NotificationListenerService.requestRebind(
          ComponentName(ctx, FinWizNotificationListenerService::class.java),
        )
      }
      true
    }

    Function("stopListening") {
      val ctx = context ?: return@Function Unit
      ListenerStore.stop(ctx)
    }

    Function("isListening") {
      val ctx = context ?: return@Function false
      ListenerStore.isEnabled(ctx)
    }

    Function("drainPendingNotifications") {
      val ctx = context ?: return@Function emptyList<Map<String, Any>>()
      ListenerStore.drain(ctx)
    }

    Function("setAllowedPackages") { packages: List<String> ->
      val ctx = context ?: return@Function Unit
      ListenerStore.setAllowedPackages(ctx, packages)
    }

    Function("getAllowedPackages") {
      val ctx = context ?: return@Function emptyList<String>()
      ListenerStore.getAllowedPackages(ctx).toList()
    }
  }
}
