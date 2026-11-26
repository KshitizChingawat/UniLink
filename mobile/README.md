# UniLink mobile apps

Android bundles the UniLink interface at build time and connects to the deployed backend. The iOS client opens the hosted UniLink workspace at `https://unilink-frontend-omky.onrender.com/dashboard` in WebKit. Users sign in with the same account they use on the website. The operating system manages installation, app storage, and removal. Network access is required for the workspace.

## Android

The signed Android 8+ package is `frontend/public/downloads/UniLink.apk`. A normal frontend production build copies it to `dist/downloads/UniLink.apk`. On an Android device, open the Downloads page, choose **Download UniLink APK**, then open the downloaded file and confirm installation. Android Settings → Apps → UniLink → Uninstall removes the package.

Install the workspace npm dependencies first. Build with Node, a JDK, Python 3, Android SDK Platform 35, and Build Tools 35.0.0. Set `ANDROID_HOME` to that SDK. For a nonstandard SDK layout, set `ANDROID_JAR` and `ANDROID_BUILD_TOOLS` to the platform jar and build-tools directory. Supply the existing release keystore through `UNILINK_KEYSTORE`, its password through `UNILINK_KEY_PASSWORD`, and its alias through `UNILINK_KEY_ALIAS` (default `unilink`). Then run:

```sh
python3 mobile/android/build.py
npm run build
```

The first local release key and password are stored in the Git-ignored `mobile/signing/` directory. Back up both privately. Updates need the same signing key and a higher `android:versionCode` in `mobile/android/AndroidManifest.xml`. The Android package ID is `io.github.kshitizchingawat.unilink`.

## iPhone and iPad

Open `ios/UniLink.xcodeproj` on a Mac with Xcode. Select the UniLink target, set the signing team and an available bundle identifier under **Signing & Capabilities**, and choose a connected development device to run the app. The deployment target is iOS 16.

For distribution, archive the app in Xcode and distribute it through TestFlight or the App Store. Once Apple provides a release link, set `VITE_IOS_INSTALL_URL` to the public TestFlight invitation or App Store URL when building the web frontend. The website displays the iOS download button when a release link is configured. Before then it offers the Safari web version.
