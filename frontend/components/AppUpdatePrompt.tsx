import { useEffect, useState } from 'react';
import { useAppInstall } from '@/lib/app-install';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const releaseMeta = 'meta[name="unilink-release"]';
const current = document.querySelector<HTMLMetaElement>(releaseMeta)?.content;
const versionParam = '_unilinkRelease';

export default function AppUpdatePrompt() {
  const { standalone } = useAppInstall();
  const installed = standalone || /\bUniLinkNative\/\d+\b/.test(navigator.userAgent);
  const [available, setAvailable] = useState('');
  const [later, setLater] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!installed || !current) return;
    const url = new URL(location.href);
    if (url.searchParams.has(versionParam)) {
      if (url.searchParams.get(versionParam) !== current) {
        setError('The new release hasn’t reached this screen yet. Try again in a moment.');
      }
      url.searchParams.delete(versionParam);
      history.replaceState(history.state, '', url);
    }
    let active = true;
    let request: AbortController | undefined;
    async function check() {
      if (document.hidden || request) return;
      request = new AbortController();
      const timeout = window.setTimeout(() => request?.abort(), 12000);
      try {
        const response = await fetch('/release.json?t=' + Date.now(), {
          cache: 'no-store', credentials: 'omit', redirect: 'error', signal: request.signal,
        });
        if (!response.ok) return;
        const { version } = await response.json();
        if (active && typeof version === 'string' && /^[a-f0-9]{64}$/.test(version)) {
          setAvailable(version === current ? '' : version);
        }
      } catch {
        // Keep the current screen usable while offline or during a deployment.
      } finally {
        clearTimeout(timeout);
        request = undefined;
      }
    }
    function resume() {
      if (document.hidden) return;
      setLater('');
      void check();
    }
    void check();
    const interval = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      active = false;
      request?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [installed]);

  async function update() {
    setUpdating(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const url = new URL(location.href);
      url.searchParams.set(versionParam, available);
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new Error();
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (html.querySelector<HTMLMetaElement>(releaseMeta)?.content !== available) throw new Error();
      location.replace(url.href);
    } catch {
      setError('Couldn’t load the update. Check your connection and try again.');
      setUpdating(false);
    } finally {
      clearTimeout(timeout);
    }
  }

  function dismiss() {
    if (!updating) { setLater(available); setError(''); }
  }
  return <AlertDialog open={Boolean(available && available !== later)} onOpenChange={open => { if (!open) dismiss(); }}>
    <AlertDialogContent className="w-[calc(100%-2rem)] rounded-xl">
      <AlertDialogHeader>
        <AlertDialogTitle>Update UniLink?</AlertDialogTitle>
        <AlertDialogDescription>A new version is ready. Updating reloads this screen. Save any unfinished work first.</AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="status" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <Button variant="outline" disabled={updating} onClick={dismiss}>Later</Button>
        <Button disabled={updating} onClick={update}>{updating ? 'Updating…' : 'Update now'}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
