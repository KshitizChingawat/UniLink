# UniLink mobile apps

The Android and iOS clients open the hosted UniLink workspace at `https://unilink-frontend-omky.onrender.com/dashboard`. Users sign in with the same account they use on the website. The operating system manages installation, app storage, and removal. Network access is required for the workspace.

Installed apps check the web release when opened, when brought back online or into the foreground, and once a minute while visible. **Update now** reloads the current screen with the deployed interface. New launches load the current release directly. Server-only changes apply on subsequent requests. Android versions 1.0 and 1.1 need a one-time update over the existing installation to 1.2 or later. Native wrapper or permission changes still require a native release.

## Android

The signed Android 8+ package is `frontend/public/downloads/UniLink.apk`. A normal frontend production build copies it to `dist/downloads/UniLink.apk`. On an Android device, open the Downloads page, choose **Download UniLink APK**, then open the downloaded file and confirm installation. Android Settings → Apps → UniLink → Uninstall removes the package.

Build the APK with a JDK, Python 3, Android SDK Platform 35, and Build Tools 35.0.0. Set `ANDROID_HOME` to that SDK. For a nonstandard SDK layout, set `ANDROID_JAR` and `ANDROID_BUILD_TOOLS` to the platform jar and build-tools directory. Supply the existing release keystore through `UNILINK_KEYSTORE`, its password through `UNILINK_KEY_PASSWORD`, and its alias through `UNILINK_KEY_ALIAS` (default `unilink`). Then run:

```sh
python3 mobile/android/build.py
npm run build
```

The first local release key and password are stored in the Git-ignored `mobile/signing/` directory. Back up both privately. Updates need the same signing key and a higher `android:versionCode` in `mobile/android/AndroidManifest.xml`. The Android package ID is `io.github.kshitizchingawat.unilink`.

## iPhone and iPad

Open `ios/UniLink.xcodeproj` on a Mac with Xcode. Select the UniLink target, set the signing team and an available bundle identifier under **Signing & Capabilities**, and choose a connected development device to run the app. The deployment target is iOS 16.

For distribution, archive the app in Xcode and distribute it through TestFlight or the App Store. Once Apple provides a release link, set `VITE_IOS_INSTALL_URL` to the public TestFlight invitation or App Store URL when building the web frontend. The website displays the iOS download button when a release link is configured. The Safari Home Screen installation steps are available with or without a native release.
