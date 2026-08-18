# Notification Fixture

A tiny standalone Android app for testing FinWiz's notification-capture pipeline on an emulator, **without needing the real bank apps installed**.

## Why this exists

FinWiz's `FinWizNotificationListenerService` routes captured notifications by their **source package name** (`com.nu.production` for Nubank, `br.com.intermedium` for Inter, etc. — see `apps/mobile/lib/ingestionPipeline.ts`'s `BANK_PACKAGES`). A generic `adb shell cmd notification post` only lets you post as `com.android.shell`, which never matches a bank parser and only exercises the generic fallback path.

This project builds one APK per supported bank, each under that bank's exact `applicationId`, so a notification it posts looks — to FinWiz's listener — exactly like the real bank app posted it. This is purely a local dev/QA harness: it never touches a store, never mimics any bank's real UI/branding/functionality beyond carrying the right package identity.

## Structure

One Gradle product flavor per bank, sharing a single trivial `MainActivity` (two text fields + a "Post Notification" button):

| Flavor | applicationId | Bank |
|--------|---------------|------|
| `nubank` | `com.nu.production` | Nubank |
| `inter` | `br.com.intermedium` | Inter |
| `itau` | `com.itau` | Itaú |
| `bradesco` | `com.bradesco` | Bradesco |
| `c6` | `com.c6bank.app` | C6 Bank |
| `santander` | `br.com.santander.benvisavale` | Santander |

## Building & running

1. Open this `tools/notification-fixture/` folder as its own project in Android Studio (File → Open) — it's intentionally separate from the `FinWiz App` React Native project, so don't open it from inside that workspace.
2. Let Gradle sync (Android Studio will offer to generate the Gradle wrapper on first open if needed).
3. **Build → Select Build Variant** and pick the flavor for the bank you want to test (e.g. `nubankDebug`).
4. Run it on the **same emulator** where the FinWiz app is installed.
5. On FinWiz, grant Notification Access to itself (Settings app → Notifications → Special app access → Notification access — or via FinWiz's own onboarding notification-permission step) and make sure the target bank is selected/allowed in FinWiz's Settings (or leave the bank list empty, which FinWiz treats as "allow all").
6. In the fixture app, enter a title and paste real (or crafted) notification body text — the `packages/notification-parser/src/__tests__` fixture files are a good source of realistic sample text per bank — and tap **Post Notification**.
7. Check FinWiz: the transaction should appear via the live listener pipeline, parsed by the matching bank parser (not the generic fallback), the same way a real bank notification would be handled.

## Extending to new banks

Once M14-T3 (bank expansion) confirms a real, verified `applicationId` for a new bank (Caixa Econômica Federal, Banco do Brasil, etc.), add a matching `productFlavor` block in `app/build.gradle`. **Do not guess a package name** — an incorrect one just means the fixture silently fails to match FinWiz's listener filter, which is a confusing false negative during testing.

## Uninstalling

Each flavor installs as a completely separate app (different `applicationId`), so uninstall each one you no longer need from the emulator individually — they don't share data or a single "app" to uninstall.
