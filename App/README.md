# Ana Chat Android (Capacitor)

This folder packages the `frontend/` web app into an Android APK using Capacitor.

## Build steps (Windows)

1. Build web app:
   - `npm install`
   - `npm run build`

2. Prepare Capacitor app:
   - `cd App`
   - `npm install`
   - `npm run sync:web`
   - `npm run cap:add:android` (first time only)
   - `npm run cap:sync:android`

3. Build APK:
   - Debug: `npm run android:apk:debug` → `App/android/app/build/outputs/apk/debug/app-debug.apk`
   - Release: `npm run android:apk:release` → `App/android/app/build/outputs/apk/release/app-release.apk`

Notes:
- You need Android Studio + JDK installed, and `JAVA_HOME` configured.
- For release APK signing, configure keystore in `App/android/app/build.gradle`.

