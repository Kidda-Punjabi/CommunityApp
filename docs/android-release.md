# Android release

The Android app is a Capacitor shell. It loads `https://webapp.kidda.app` and sends the same `KiddaApp/1.0` user agent as iOS. Package name `app.kidda`. `versionCode` 1, `versionName` 1.0.0. `minSdk` 24, `compileSdk` and `targetSdk` 36.

Do not commit the upload keystore, `keystore.properties`, or `google-services.json`.

## 1. Create the upload key

From the repo root:

```bash
mkdir -p ~/kidda-keys
keytool -genkeypair -v \
  -keystore ~/kidda-keys/kidda-upload.jks \
  -alias kidda \
  -keyalg RSA -keysize 2048 -validity 10000
```

SHA-256 of that upload key:

```bash
keytool -list -v -keystore ~/kidda-keys/kidda-upload.jks -alias kidda | grep SHA256
```

## 2. Play App Signing

In Play Console, create the app `app.kidda` and turn on Play App Signing. Play shows a second SHA-256, the app signing certificate. Put both fingerprints in Vercel as `ANDROID_CERT_SHA256`, comma-separated, upload key first:

```text
AA:BB:...:CC, DD:EE:...:FF
```

`https://webapp.kidda.app/.well-known/assetlinks.json` returns `[]` until that variable is set, then one statement per fingerprint. Redeploy after saving it. Check verification with:

```bash
adb shell pm get-app-links app.kidda
```

## 3. Sign the release AAB

Either environment variables:

```bash
export ANDROID_KEYSTORE_PATH="$HOME/kidda-keys/kidda-upload.jks"
export ANDROID_KEYSTORE_PASSWORD="..."
export ANDROID_KEY_ALIAS="kidda"
export ANDROID_KEY_PASSWORD="..."
```

Or `android/keystore.properties` (gitignored):

```properties
storeFile=/absolute/path/kidda-upload.jks
storePassword=...
keyAlias=kidda
keyPassword=...
```

Build:

```bash
cd android
./gradlew bundleRelease
```

The signed file is `android/app/build/outputs/bundle/release/app-release.aab`. Upload that to Play Console.

## 4. Firebase Cloud Messaging

1. Create a Firebase project and add an Android app with package `app.kidda`.
2. Download `google-services.json` into `android/app/google-services.json`. The Gradle plugin applies only when that file is present, so a build without it still succeeds and push registration waits until the file is added.
3. In Firebase, create a service account that can send messages. Download its JSON key.
4. Set Vercel `FCM_SERVICE_ACCOUNT_JSON` to the full JSON. Until it is set, Android sends return `unconfigured` and iOS APNs is unchanged.

The app creates a notification channel named Kidda (`kidda`, default importance) and asks for `POST_NOTIFICATIONS` on Android 13+ from the same “Never miss a class” prompt iOS uses. Tokens are stored in `device_push_tokens` with `platform = 'android'`. An FCM `UNREGISTERED` response disables the token, the same as a bad APNs token. Send log rows record `platform`.
