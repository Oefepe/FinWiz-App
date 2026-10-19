package com.finwiz.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinWizNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val pkg = sbn.packageName ?: return
    // The system keeps this service bound whenever notification access is
    // granted — only act once the app has explicitly asked to watch.
    if (!ListenerStore.isEnabled(this)) return

    val allowed = ListenerStore.getAllowedPackages(this)
    // Empty allowlist = forward everything live (JS filters by known
    // package), but never queue arbitrary apps' notifications to disk.
    if (allowed.isNotEmpty() && pkg !in allowed) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString() ?: ""
    val text = extras.getCharSequence("android.text")?.toString() ?: ""

    val delivered = FinWizNotificationListenerModule.emitNotification(
      appPackage = pkg,
      title = title,
      body = text,
      timestamp = sbn.postTime,
    )
    if (!delivered && allowed.isNotEmpty()) {
      ListenerStore.enqueue(this, pkg, title, text, sbn.postTime)
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) = Unit
}
