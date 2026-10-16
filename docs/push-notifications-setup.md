# Push notifications setup

Kidda sends iOS pushes from the Next.js server with APNs token auth. Browser users do not get a permission prompt. The Apple portal steps below are for Gurupma. The app code, database, and Vercel cron are already in the repo.

## 1. Create the APNs key

1. Open [Apple Developer](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → Keys.
2. Create a key with **Apple Push Notifications service (APNs)** enabled.
3. Download the `.p8` file. Apple only allows this download once. Note the **Key ID**.
4. Note the **Team ID** from the membership page. Do not invent one. The repo does not store it.

## 2. Turn the capability on in Xcode

The iOS project already has `aps-environment` set to `development` in `ios/App/App/App.entitlements`, and `remote-notification` in `Info.plist`. Confirm both in Xcode so signing matches the provisioning profile:

1. Open `ios/App/App.xcworkspace`.
2. Select the App target → Signing & Capabilities.
3. Add **Push Notifications**.
4. Add **Background Modes** and tick **Remote notifications**.
5. For a TestFlight or App Store archive, the push entitlement must be production. Xcode sets that from the distribution profile. Debug builds from Xcode stay on the sandbox.

## 3. Vercel environment variables

Add these to the `community-app-v2` project for Production (and Preview if you test pushes there):

| Name | Value |
| --- | --- |
| `APNS_KEY_ID` | The Key ID from step 1 |
| `APNS_TEAM_ID` | The Apple Team ID |
| `APNS_KEY_P8` | The full `.p8` file contents, including the BEGIN/END lines |
| `APNS_BUNDLE_ID` | `app.kidda` |
| `APNS_ENV` | `sandbox` for Xcode debug builds. `production` for TestFlight and the App Store |

Until these are set, the app still records tokens and the sender returns `unconfigured` without crashing requests.

Redeploy after saving the variables.

## How a device registers

The app does not ask at launch. After the first login, the iOS shell shows “Never miss a class”. Only **Allow notifications** calls the system permission prompt. **Not now** shows the screen once more after the next class ends, then stops. Profile → Notifications still has a Push notifications switch. If permission was denied, it opens iOS Settings via `AppLauncher.openUrl({ url: "app-settings:" })`. Capacitor’s App plugin does not include `openUrl`.

## Data used for each reminder

- Community sessions are `events` rows with `required_tier = community`. There is no session-type column. Both weekly classes (Wednesday and Sunday) are included.
- A lesson has homework when `lesson_segments.activity_type = 'homework'`.
- Streak milestones are sent from `recordStreakActivity` (the browser calls `/api/push/streak-milestone`). The reminder cron also sends one if that milestone is not in the log yet, which covers server-side streak updates.
- Calendar sync deletes cancelled Google events instead of setting `status = cancelled`. The class-cancelled push is sent from that delete. A moved class is a change to `starts_at` on an in-place update.
- “We missed you” (the second missed Community session) is not sent. There is no attendance or check-in table to count misses.

Notification rows inserted outside `insertRoutedNotifications` are still pushed by the 5-minute sweep: group purchase, tutor cover, student-discount admin actions, and the homework-reviewed database trigger.
