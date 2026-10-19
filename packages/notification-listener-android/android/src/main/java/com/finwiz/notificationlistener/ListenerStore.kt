package com.finwiz.notificationlistener

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists the app's watch request (enabled flag + package allowlist) and a
 * small queue of notifications that arrived while no JS listener was
 * attached (app killed or backgrounded past React teardown).
 *
 * Persisting matters because the system binds FinWizNotificationListenerService
 * independently of the React app — after a process restart the service runs
 * before (or without) JS ever calling startListening(), so in-memory state
 * would be empty and it would either forward everything or drop everything.
 *
 * The queue holds raw title/body text in app-private storage until the app
 * next drains it. It is bounded (MAX_PENDING) and entries expire after
 * PENDING_TTL_MS, and only allowlisted packages are ever queued.
 */
internal object ListenerStore {
  private const val PREFS = "finwiz_notification_listener"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_PACKAGES = "allowed_packages"
  private const val KEY_PENDING = "pending"
  private const val MAX_PENDING = 100
  private const val PENDING_TTL_MS = 7L * 24 * 60 * 60 * 1000

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ENABLED, false)

  fun getAllowedPackages(ctx: Context): Set<String> =
    prefs(ctx).getStringSet(KEY_PACKAGES, emptySet())?.toSet() ?: emptySet()

  fun setAllowedPackages(ctx: Context, packages: Collection<String>) {
    prefs(ctx).edit().putStringSet(KEY_PACKAGES, packages.toSet()).apply()
  }

  @Synchronized
  fun start(ctx: Context, packages: Collection<String>) {
    prefs(ctx).edit()
      .putBoolean(KEY_ENABLED, true)
      .putStringSet(KEY_PACKAGES, packages.toSet())
      .apply()
  }

  /** Stops watching and discards anything still queued. */
  @Synchronized
  fun stop(ctx: Context) {
    prefs(ctx).edit()
      .putBoolean(KEY_ENABLED, false)
      .remove(KEY_PENDING)
      .apply()
  }

  @Synchronized
  fun enqueue(ctx: Context, appPackage: String, title: String, body: String, timestamp: Long) {
    val now = System.currentTimeMillis()
    val current = readPending(ctx).filter { now - it.optLong("timestamp") < PENDING_TTL_MS }
    val next = JSONArray()
    current.takeLast(MAX_PENDING - 1).forEach { next.put(it) }
    next.put(
      JSONObject()
        .put("appPackage", appPackage)
        .put("title", title)
        .put("body", body)
        .put("timestamp", timestamp),
    )
    prefs(ctx).edit().putString(KEY_PENDING, next.toString()).apply()
  }

  /** Returns and clears every queued notification, oldest first. */
  @Synchronized
  fun drain(ctx: Context): List<Map<String, Any>> {
    val now = System.currentTimeMillis()
    val items = readPending(ctx)
      .filter { now - it.optLong("timestamp") < PENDING_TTL_MS }
      .map {
        mapOf<String, Any>(
          "appPackage" to it.optString("appPackage"),
          "title" to it.optString("title"),
          "body" to it.optString("body"),
          "timestamp" to it.optLong("timestamp").toDouble(),
        )
      }
    prefs(ctx).edit().remove(KEY_PENDING).apply()
    return items
  }

  private fun readPending(ctx: Context): List<JSONObject> {
    val raw = prefs(ctx).getString(KEY_PENDING, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
    } catch (_: Exception) {
      emptyList()
    }
  }
}
