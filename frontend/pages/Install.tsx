import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, Download, Laptop, Smartphone, Tablet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Logo from '@/components/Logo';
import DeviceAnimation from '@/components/DeviceAnimation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requestInstall, useAppInstall } from '@/lib/app-install';

const devices = [
  { id: 'ios', label: 'iPhone / iPad', icon: Tablet },
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'desktop', label: 'Computer', icon: Laptop },
] as const;
type Device = typeof devices[number]['id'];

function currentDevice(): Device {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

const iosReleaseUrl = (import.meta.env.VITE_IOS_INSTALL_URL ?? '').trim();
const hasIosRelease = /^https:\/\/(?:testflight\.apple\.com\/join\/[A-Za-z0-9]+|apps\.apple\.com\/[^\s]+)$/.test(iosReleaseUrl);

function installGuide(device: Device) {
  if (device === 'ios') return { title: 'UniLink for iPhone and iPad', steps: hasIosRelease ? [
    'Open the Apple distribution link on your iPhone or iPad.',
    'Follow the prompts in TestFlight or the App Store to install UniLink.',
    'Launch UniLink from your App Library. To uninstall it, touch and hold its icon and choose Delete App.',
  ] : [] };
  if (device === 'android') return { title: 'UniLink for Android', steps: [
    'Download the signed UniLink APK on your Android phone or tablet.',
    'Open UniLink.apk from Downloads and tap Install. If Android asks, allow this browser to install this app.',
    'Tap Open or find UniLink in your app drawer. To remove it, open its App info and tap Uninstall.',
  ] };
  if (/Macintosh/.test(navigator.userAgent) && /^((?!chrome|android|edg).)*safari/i.test(navigator.userAgent)) {
    return { title: 'Add to your Dock', steps: [
      'Open this page in Safari on macOS Sonoma or later.',
      'Choose File, then Add to Dock.',
      'Click Add and open UniLink from your Dock.',
    ] };
  }
  return { title: 'Install on your computer', steps: [
    'Open this page in Chrome on Windows, macOS, Linux or ChromeOS.',
    'Click the install icon in the address bar, or open the Chrome menu and choose Cast, save, and share, then Install page as app.',
    'Confirm and open UniLink from your apps.',
  ] };
}

function Install() {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  const device = currentDevice();
  const [selected, setSelected] = useState<Device>(device);
  const [feedback, setFeedback] = useState('');
  const { canPrompt, installed, standalone } = useAppInstall();
  const native = /\bUniLinkNative\/1\b/.test(navigator.userAgent);
  const ready = native || ((installed || standalone) && selected === 'desktop');
  const guide = installGuide(selected);
  const showQR = device === 'desktop' && location.protocol === 'https:' && !standalone && !native;

  async function install() {
    const result = await requestInstall();
    setFeedback(result === 'accepted' ? 'Install request accepted. Your browser will finish setup.' :
      result === 'dismissed' ? 'Installation canceled. You can still use the web version or follow the steps below.' :
      'Use the browser menu steps below to install UniLink.');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/" aria-label="UniLink home"><Logo size="sm" /></Link>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:text-blue-600">
          {standalone ? 'Open workspace' : 'Continue on web'}<ArrowRight size={16} />
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-8 lg:py-10">
        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[.9fr_1.1fr]">
          <section className="relative isolate flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white sm:p-10">
            <div>
              <h1 className="max-w-sm text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Install UniLink</h1>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-blue-100">Open your files, clipboard, and connected devices from a single app icon.</p>
            </div>
            <div className="mx-auto mt-5 hidden w-full max-w-56 sm:block lg:my-6 lg:max-w-72"><DeviceAnimation /></div>
            {showQR && <div className="hidden items-center gap-4 border-t border-white/20 pt-5 lg:flex">
              <div className="shrink-0 rounded-lg bg-white p-2"><QRCodeSVG value={location.origin + '/install'} size={72} marginSize={4} title="UniLink install link" /></div>
              <p className="max-w-48 text-sm leading-relaxed text-blue-100">Scan with your phone or tablet to install UniLink there.</p>
            </div>}
          </section>
          <section className="flex min-w-0 flex-col justify-center p-5 sm:p-10">
            {ready ? <div role="status">
              <Check className="mb-4 size-9 rounded-full bg-green-100 p-2 text-green-700" />
              <h2 className="text-2xl font-bold">UniLink is installed</h2>
              <p className="my-4 text-muted-foreground">Open your workspace here or launch UniLink from your device’s app icon.</p>
              <Button asChild><Link href="/dashboard">Open workspace<ArrowRight /></Link></Button>
            </div> : <>
              <h2 className="mb-5 text-xl font-semibold tracking-tight">Choose your device</h2>
              <Tabs value={selected} onValueChange={value => { setSelected(value as Device); setFeedback(''); }}>
                <TabsList aria-label="Installation platform" className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1">
                  {devices.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="min-h-14 flex-col gap-1 rounded-lg px-1 text-xs sm:text-sm">
                    <Icon className="size-4" aria-hidden="true" />{label}
                  </TabsTrigger>)}
                </TabsList>
                <TabsContent key={selected} value={selected} className="mt-7 motion-safe:animate-fade-in">
                  <h3 className="text-2xl font-bold leading-tight tracking-tight">{guide.title}</h3>
                  {selected === 'android' && <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                    <a href="/downloads/UniLink.apk" download="UniLink.apk"><Download />Download UniLink APK</a>
                  </Button>}
                  {selected === 'ios' && (hasIosRelease ? <Button asChild size="lg" className="mt-4">
                    <a href={iosReleaseUrl}>Get the iOS app<ArrowRight /></a>
                  </Button> : <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    The iOS app is awaiting a signed release. For now, use UniLink in Safari. To add the web version to your Home Screen, tap Share, then Add to Home Screen.
                  </p>)}
                  {selected === 'desktop' && selected === device && canPrompt && <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={install}><Download />Install on this device</Button>}
                  <p className="mt-3 text-sm text-muted-foreground" role="status">{feedback}</p>
                  {guide.steps.length > 0 && <ol className="mt-4 space-y-4">
                    {guide.steps.map((step, index) => <li key={step} className="grid grid-cols-[1.75rem_1fr] gap-3">
                      <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{index + 1}</span>
                      <span className="pt-0.5 text-sm leading-6 text-slate-700 dark:text-slate-200">{step}</span>
                    </li>)}
                  </ol>}
                </TabsContent>
              </Tabs>
              <p className="mt-7 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
                {window.isSecureContext ? 'Sync and file transfers need an internet connection.' : 'Open the HTTPS version of UniLink to install the app on this device.'}
              </p>
            </>}
          </section>
        </div>
        <section aria-labelledby="hope-download" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 sm:p-7">
          <div>
            <h2 id="hope-download" className="text-xl font-semibold">Hope for Android</h2>
            <p className="mt-1 text-sm text-muted-foreground">Android 8 or later. Connect to the Hope server after installation.</p>
          </div>
          <Button asChild><a href="/downloads/Hope.apk" download="Hope.apk"><Download aria-hidden="true" />Download Hope APK</a></Button>
        </section>
      </main>
    </div>
  );
}

export default Install;
