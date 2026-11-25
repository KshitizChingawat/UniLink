import { useSyncExternalStore } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const display = window.matchMedia('(display-mode: standalone)');
const isStandalone = () => display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const listeners = new Set<() => void>();
let prompt: InstallPrompt | null = null;
let installed = false;
let state = { standalone: isStandalone(), installed, canPrompt: false };

function publish() {
  state = { standalone: isStandalone(), installed, canPrompt: Boolean(prompt) };
  listeners.forEach(listener => listener());
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  prompt = event as InstallPrompt;
  installed = false;
  publish();
});
window.addEventListener('appinstalled', () => {
  prompt = null;
  installed = true;
  publish();
});
if (display.addEventListener) display.addEventListener('change', publish);
else display.addListener(publish);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const useAppInstall = () => useSyncExternalStore(subscribe, () => state);

export async function requestInstall() {
  const event = prompt;
  if (!event) return 'unavailable';
  prompt = null;
  publish();
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return 'unavailable';
  }
}
