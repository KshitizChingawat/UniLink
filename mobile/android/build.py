"""Build a signed UniLink APK with the Android SDK and JDK. See mobile/README.md."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

android = Path(__file__).resolve().parent
root = android.parents[1]
sdk = Path(os.environ.get("ANDROID_HOME", ""))
tools = Path(os.environ.get("ANDROID_BUILD_TOOLS", sdk / "build-tools/35.0.0"))
platform = Path(os.environ.get("ANDROID_JAR", sdk / "platforms/android-35/android.jar"))
keystore = Path(os.environ["UNILINK_KEYSTORE"]).resolve()
alias = os.environ.get("UNILINK_KEY_ALIAS", "unilink")
if not os.environ.get("UNILINK_KEY_PASSWORD") or not keystore.is_file():
    raise SystemExit("Set UNILINK_KEYSTORE and UNILINK_KEY_PASSWORD before building.")

def run(*args):
    subprocess.run(list(map(str, args)), check=True)

with tempfile.TemporaryDirectory(prefix="unilink-apk-") as folder:
    build = Path(folder)
    # Use the deployed frontend origin in WebView so the backend's existing CORS
    # configuration applies. Only immutable app assets are bundled, never APK downloads.
    web = build / "web"
    api = os.environ.get("VITE_API_BASE_URL", "https://unilink-backend-8tyj.onrender.com")
    subprocess.run(["npm", "exec", "--", "vite", "build", "--target", "chrome67",
                    "--outDir", str(web), "--emptyOutDir"], cwd=root / "frontend",
                   env={**os.environ, "VITE_API_BASE_URL": api}, check=True)
    assets = build / "assets"
    assets.mkdir()
    shutil.copyfile(web / "index.html", assets / "index.html")
    for directory in ["assets", "icons"]:
        shutil.copytree(web / directory, assets / directory)
    res = build / "res/drawable-nodpi"
    res.mkdir(parents=True)
    shutil.copyfile(root / "frontend/public/icons/unilink-192.png", res / "launcher.png")
    run(tools / "aapt2", "compile", "--dir", build / "res", "-o", build / "resources.zip")
    run(tools / "aapt2", "link", "-I", platform, "--manifest", android / "AndroidManifest.xml", "-A", assets,
        "-o", build / "app.apk", build / "resources.zip")
    classes = build / "classes"
    classes.mkdir()
    run("javac", "-encoding", "UTF-8", "--release", "8", "-classpath",
        platform, "-d", classes, android / "MainActivity.java")
    run(tools / "d8", "--release", "--min-api", "26", "--lib", platform, "--output", build,
        *sorted(classes.rglob("*.class")))
    with zipfile.ZipFile(build / "app.apk", "a") as archive:
        archive.write(build / "classes.dex", "classes.dex")
    run(tools / "zipalign", "-f", "4", build / "app.apk", build / "aligned.apk")
    signed = build / "UniLink.apk"
    run(tools / "apksigner", "sign", "--ks", keystore, "--ks-key-alias", alias,
        "--ks-pass", "env:UNILINK_KEY_PASSWORD", "--out", signed, build / "aligned.apk")
    run(tools / "apksigner", "verify", "--verbose", "--print-certs", signed)
    destination = root / "frontend/public/downloads/UniLink.apk"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(signed, destination)
    print(destination)
