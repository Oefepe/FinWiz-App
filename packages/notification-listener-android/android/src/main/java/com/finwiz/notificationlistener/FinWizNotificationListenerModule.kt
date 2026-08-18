package com.finwiz.notificationlistener

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FinWizNotificationListenerModule : Module() {

  companion object {
    // Empty set means allow all — populated via setAllowedPackages().
    private val allowedPackages = mutableSetOf<String>()
    private var instance: FinWizNotificationListenerModule? = null

    fun isAllowedPackage(pkg: String): Boolean =
      allowedPackages.isEmpty() || pkg in allowedPackages

    fun emitNotification(appPackage: String, title: String, body: String, timestamp: Long) {
      instance?.sendEvent(
        "onNotification",
        mapOf(
          "appPackage" to appPackage,
          "title" to title,
          "body" to body,
          "timestamp" to timestamp,
        ),
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("FinWizNotificationListener")

    Events("onNotification")

    OnCreate {
      instance = this@FinWizNotificationListenerModule
    }

    OnDestroy {
      if (instance === this@FinWizNotificationListenerModule) instance = null
    }

    Function("isPermissionGranted") {
      val ctx = appContext.reactContext ?: return@Function false
      val flat = Settings.Secure.getString(
        ctx.contentResolver,
        "enabled_notification_listeners",
      )
      val component =
        ComponentName(ctx, FinWizNotificationListenerService::class.java).flattenToString()
      flat?.contains(component) == true
    }

    Function("openPermissionSettings") {
      val ctx = appContext.reactContext ?: return@Function Unit
      ctx.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("setAllowedPackages") { packages: List<String> ->
      allowedPackages.clear()
      allowedPackages.addAll(packages)
    }

    Function("getAllowedPackages") {
      allowedPackages.toList()
    }
  }
}
