import { useState, useEffect, useRef } from 'react';
import { BASE_URL } from '@/lib/api';

type Status = 'checking' | 'waking' | 'ready' | 'error';

export const useBackendHealth = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const MAX_TRIES = 20; // 60 seconds total

    const ping = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!cancelled && res.ok) {
          setStatus('ready');
          return;
        }
      } catch {
        // backend sleeping or unreachable
      }

      if (cancelled) return;
      tries++;
      setAttempts(tries);
      if (tries >= MAX_TRIES) {
        setStatus('error');
        return;
      }
      setStatus('waking');
      timerRef.current = setTimeout(ping, 3000);
    };

    ping();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, attempts };
};
