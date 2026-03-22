import { useMemo, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedToggleProps {
  canActivate?: boolean;
  isSubmitting?: boolean;
  className?: string;
  idleLabel?: string;
  readyLabel?: string;
  successLabel?: string;
  onActivate?: () => Promise<boolean> | boolean;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const AnimatedToggle = ({
  canActivate = false,
  isSubmitting = false,
  className,
  idleLabel = 'Fill credentials to connect',
  readyLabel = 'Tap left module to sign in',
  successLabel = 'Connection established',
  onActivate,
}: AnimatedToggleProps) => {
  const [phase, setPhase] = useState<'idle' | 'animating' | 'connected'>('idle');

  const isAnimating = phase === 'animating' || isSubmitting;
  const isConnected = phase === 'connected';
  const isReady = canActivate && !isAnimating && !isConnected;

  const statusText = useMemo(() => {
    if (isConnected) return successLabel;
    if (isAnimating) return 'Connecting UniLink...';
    if (isReady) return readyLabel;
    return idleLabel;
  }, [idleLabel, isAnimating, isConnected, isReady, readyLabel, successLabel]);

  const handleActivate = async () => {
    if (!canActivate || isAnimating || isConnected) return;

    setPhase('animating');
    await wait(650);

    const result = await onActivate?.();
    if (result === false) {
      setPhase('idle');
      return;
    }

    setPhase('connected');
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          aria-label="Start login connection"
          onClick={handleActivate}
          disabled={!canActivate || isAnimating || isConnected}
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500',
            isConnected
              ? 'border-unilink-500 bg-unilink-50 text-unilink-600 shadow-[0_0_30px_rgba(59,130,246,0.35)]'
              : isReady
                ? 'border-unilink-400 bg-white text-unilink-600 shadow-[0_0_28px_rgba(59,130,246,0.25)]'
                : 'border-gray-300 bg-gray-50 text-gray-400',
          )}
        >
          <div
            className={cn(
              'h-5 w-5 transition-transform duration-500',
              isConnected ? 'rotate-90' : 'rotate-0',
            )}
          >
            <div className="mx-auto mt-2 h-0.5 w-4 rounded-full bg-current" />
          </div>
          {(isReady || isConnected) && (
            <div className="absolute inset-0 rounded-2xl bg-unilink-500/10 animate-pulse-glow" />
          )}
        </button>

        <div className="relative mx-3 h-2 w-24 overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-unilink-500 via-blue-500 to-purple-500 transition-all duration-700',
              isAnimating || isConnected ? 'w-full opacity-100' : 'w-0 opacity-0',
            )}
          />
          {(isAnimating || isConnected) && (
            <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md animate-pulse" style={{ left: isConnected ? 'calc(100% - 0.75rem)' : 'calc(100% - 0.75rem)' }} />
          )}
        </div>

        <div
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500',
            isConnected
              ? 'border-unilink-500 bg-unilink-50 text-unilink-600 shadow-[0_0_30px_rgba(59,130,246,0.35)]'
              : 'border-gray-300 bg-gray-50 text-gray-400',
          )}
        >
          <Smartphone className="h-7 w-7" />
          {isConnected && (
            <div className="absolute inset-0 rounded-2xl bg-unilink-500/10 animate-pulse-glow" />
          )}
        </div>
      </div>

      <p className={cn('text-sm font-medium transition-colors duration-300', isReady || isConnected ? 'text-unilink-600' : 'text-gray-500')}>
        {statusText}
      </p>
    </div>
  );
};

export default AnimatedToggle;
