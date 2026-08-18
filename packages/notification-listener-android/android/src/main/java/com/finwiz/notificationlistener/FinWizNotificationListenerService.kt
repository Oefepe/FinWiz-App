package com.finwiz.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinWizNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val pkg = sbn.packageName ?: return
    if (!FinWizNotificationListenerModule.isAllowedPackage(pkg)) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString() ?: ""
    val text = extras.getCharSequence("android.text")?.toString() ?: ""

    FinWizNotificationListenerModule.emitNotification(
      appPackage = pkg,
      title = title,
      body = text,
      timestamp = sbn.postTime,
    )
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) = Unit
}
