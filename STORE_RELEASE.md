# CardioBrain: Store release

The native apps are Capacitor shells around the same web build, bundled in (no hosted URL), so they run fully offline.

App id: `com.mikeylambo.cardiobrain` (one constant, in `capacitor.config.ts`). **Confirm it before the first submission. It can never change afterwards.**

## What only you can do

1. **Apple Developer Program enrollment** ($99/year) at developer.apple.com, as an individual or an organisation.
2. **Google Play Console registration** ($25, one time) at play.google.com/console, including identity verification.
3. **Signing:** an Apple distribution certificate and provisioning profile (Xcode can manage these automatically once you are enrolled), and an Android upload keystore. Create the keystore yourself and back it up; losing it means you can never update the app.
4. **App Store Connect and Play Console records:** create the app, paste the listing from `store/listing.md`, upload the screenshots from `store/screenshots/`, and answer the privacy questions (all answers are in the listing file).
5. **Pressing Submit** on both stores.

Everything else is done and checked into the repo: icons, splash screens, native projects, listing copy, privacy answers, review notes and screenshots.

## Build the web bundle and sync it into the native projects

```bash
npm ci
npm run build        # typecheck, lint, tests, contrast, then vite build
npx cap sync         # copies dist/ into ios/ and android/, and updates the plugins
```

Icons and splash screens come from `assets/` (1024×1024 icon master, 2732×2732 splash master):

```bash
npx capacitor-assets generate --iconBackgroundColor '#16181D' --splashBackgroundColor '#16181D'
```

## iOS (needs a Mac with Xcode 16 or later)

1. Open the project: `npx cap open ios` (or open `ios/App/App.xcodeproj`).
2. Select the **App** target, then **Signing & Capabilities**. Set **Team** to your developer team and leave "Automatically manage signing" on. The bundle identifier is `com.mikeylambo.cardiobrain`.
3. Under **General**, set **Version** to `2.0.0` and **Build** to `1`, and bump Build for every upload.
4. Run on a simulator first: pick an iPhone 16 simulator and press Run. Play one session: haptics are silent in the simulator, but sound plays.
5. Archive: choose **Any iOS Device (arm64)** as the destination, then **Product → Archive**.
6. In the Organizer: **Distribute App → App Store Connect → Upload**.
7. In App Store Connect, the build appears under TestFlight after processing (about 15 minutes). Add it to the version, fill in the listing, and submit for review.

## Android (Android Studio, JDK 21)

1. Open the project: `npx cap open android` (or open the `android/` folder in Android Studio).
2. Create an upload key once, and keep it safe:
   ```bash
   keytool -genkey -v -keystore cardiobrain-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
3. In `android/app/build.gradle`, set `versionCode 1` and `versionName "2.0.0"`, and increase versionCode for every upload.
4. **Build → Generate Signed App Bundle → Android App Bundle**, choose the keystore, and pick the **release** variant. Or from the command line:
   ```bash
   cd android && ./gradlew bundleRelease
   # then sign: jarsigner -keystore cardiobrain-upload.jks app/build/outputs/bundle/release/app-release.aab upload
   ```
5. In Play Console, create the app, enroll in Play App Signing, and upload the `.aab` to an internal testing track first, then to production.

## v2.1 native setup (one-time, in Xcode and Android Studio)

- **HealthKit (iOS):** App target → Signing & Capabilities → **+ Capability → HealthKit**. Add `NSHealthUpdateUsageDescription` ("CardioBrain can log your sessions to Health as mindful minutes.") to `Info.plist`. This is only needed if you keep the Log to Health setting.
- **Health Connect (Android):** add `<uses-permission android:name="android.permission.health.WRITE_MINDFULNESS" />` to `AndroidManifest.xml`, and a privacy-policy activity alias as described in the @capgo/capacitor-health README.
- **Microphone and speech:** the iOS usage strings are already in `Info.plist`. On Android, `RECORD_AUDIO` and the recognition/TTS `<queries>` are already in the manifest.
- **URL scheme:** `cardiobrain://` is registered on both platforms. Siri Shortcuts can use "Open URL" with `cardiobrain://start?activity=bike`.
- **Bluetooth heart-rate straps (native):** `NSBluetoothAlwaysUsageDescription` is in `Info.plist`, and `BLUETOOTH_SCAN` (neverForLocation) and `BLUETOOTH_CONNECT` are in the Android manifest.
- **Landscape:** now allowed on phones, with the treadmill layout.

### Store answers that change with v2.1

- **Privacy label:** still "Data Not Collected". Audio is processed by the OS recogniser and never reaches you, the developer. Health data is written only to the user's own Health store.
- **App Review notes, add:** "Voice answers and spoken prompts are optional, off by default, and request microphone and speech permission only when turned on. Heart-rate straps connect over standard Bluetooth Heart Rate service and are optional."
- **App preview video:** `store/preview/app-preview-6.9in.mp4` (886×1920, 29.5 s, H.264 with a silent AAC track), recorded from a real first round.

## Before each release

- Run `npm run build && npm run e2e`. Optionally run `npm run e2e:long` (about 15 minutes).
- Run `npx cap sync`.
- Bump the iOS Build and the Android versionCode.

## State of this build

- `ios/` and `android/` were generated with Capacitor 8 and sync without errors.
- Portrait is locked, iPad requires full screen, and `ITSAppUsesNonExemptEncryption` is false, so App Store Connect won't ask about encryption.
- They were **not** compiled here: the build machine is Linux and has no Xcode or Android SDK. Your first native build happens in Xcode and Android Studio, using the steps above.
