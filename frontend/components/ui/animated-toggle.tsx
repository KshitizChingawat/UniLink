import { useMemo, useState } from 'react';
import { ArrowRight, Smartphone } from 'lucide-react';
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
        <div
          className={cn(
            'pointer-events-none absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 rounded-full blur-2xl transition-all duration-700',
            isConnected
              ? 'bg-gradient-to-r from-cyan-400/25 via-unilink-500/20 to-violet-500/25 opacity-100'
              : isReady
                ? 'bg-gradient-to-r from-unilink-400/20 via-sky-400/15 to-violet-400/20 opacity-100'
                : 'bg-slate-300/20 opacity-60',
          )}
        />
        <button
          type="button"
          aria-label="Start login connection"
          onClick={handleActivate}
          disabled={!canActivate || isAnimating || isConnected}
          className={cn(
            'group relative z-10 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-500',
            isConnected
              ? 'border-unilink-400/80 bg-white text-unilink-700 shadow-[0_16px_45px_rgba(59,130,246,0.28)]'
              : isReady
                ? 'border-unilink-300 bg-white text-unilink-600 shadow-[0_14px_34px_rgba(59,130,246,0.18)] hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(59,130,246,0.24)]'
                : 'border-slate-200 bg-slate-50 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
          )}
        >
          <div
            className={cn(
              'absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.95),rgba(255,255,255,0.35)_42%,transparent_70%)] opacity-80 transition-opacity duration-500',
              isReady || isConnected ? 'opacity-100' : 'opacity-65',
            )}
          />
          <div
            className={cn(
              'absolute inset-x-2 top-0 h-px bg-white/80 transition-opacity duration-500',
              isReady || isConnected ? 'opacity-100' : 'opacity-50',
            )}
          />
          <div
            className={cn(
              'relative z-10 flex h-7 w-7 items-center justify-center transition-transform duration-500',
              isConnected
                ? 'scale-105'
                : isReady
                  ? 'scale-100 group-hover:translate-x-0.5'
                  : 'scale-100',
            )}
          >
            <div className="absolute inset-1 rounded-full border border-current/15" />
            <div
              className={cn(
                'absolute inset-0 rounded-full border border-current/10 transition-all duration-500',
                isReady || isConnected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
              )}
            />
            <div
              className={cn(
                'h-5 w-5 transition-transform duration-500',
                isAnimating || isConnected ? 'rotate-90' : 'rotate-0',
              )}
            >
              <div className="mx-auto mt-2 h-0.5 w-4 rounded-full bg-current shadow-[0_1px_2px_rgba(255,255,255,0.35)]" />
            </div>
          </div>
          {(isReady || isConnected) && (
            <>
              <div className="absolute inset-0 rounded-2xl bg-unilink-500/10 animate-pulse-glow" />
              <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.2)_35%,rgba(255,255,255,0.78)_50%,rgba(255,255,255,0.2)_65%,transparent_100%)] animate-shimmer" />
            </>
          )}
        </button>

        <div className="relative mx-3 h-2.5 w-24 overflow-hidden rounded-full bg-slate-200/90 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
          <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0))]" />
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-unilink-500 to-violet-500 transition-all duration-700',
              isAnimating || isConnected ? 'w-full opacity-100' : 'w-0 opacity-0',
            )}
          />
          <div
            className={cn(
              'absolute top-1/2 z-10 -translate-y-1/2 text-white transition-all duration-700',
              isAnimating || isConnected ? 'opacity-100' : 'opacity-0',
            )}
            style={{ left: isAnimating || isConnected ? 'calc(100% - 1.4rem)' : '0.35rem' }}
          >
            <ArrowRight className="h-3.5 w-3.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]" strokeWidth={2.2} />
          </div>
          {(isAnimating || isConnected) && (
            <div className="absolute inset-y-[2px] left-0 w-10 rounded-full bg-white/40 blur-sm animate-[pulse_1.4s_ease-in-out_infinite]" />
          )}
          {(isAnimating || isConnected) && (
            <>
              <div className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/80" />
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
              <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/70 bg-white shadow-[0_0_18px_rgba(255,255,255,0.95)]" style={{ left: 'calc(100% - 0.875rem)' }} />
            </>
          )}
        </div>

        <div
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-500',
            isConnected
              ? 'border-unilink-400/80 bg-white text-unilink-700 shadow-[0_16px_45px_rgba(59,130,246,0.28)]'
              : isAnimating
                ? 'border-unilink-200 bg-white text-unilink-500 shadow-[0_12px_32px_rgba(59,130,246,0.18)]'
                : 'border-slate-200 bg-slate-50 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.92),rgba(255,255,255,0.28)_42%,transparent_72%)]" />
          <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(160deg,rgba(255,255,255,0.22),transparent_55%)]" />
          <Smartphone
            className={cn(
              'relative z-10 h-7 w-7 transition-transform duration-500',
              isAnimating ? 'scale-105' : '',
              isConnected ? 'scale-105' : '',
            )}
          />
          <div className="absolute bottom-3 left-1/2 z-10 h-0.5 w-3 -translate-x-1/2 rounded-full bg-current/35" />
          {(isReady || isAnimating || isConnected) && (
            <>
              <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-current/75" />
              <div
                className={cn(
                  'absolute right-[11px] top-[10px] h-3.5 w-3.5 rounded-full border border-current/25 transition-all duration-500',
                  isAnimating || isConnected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                )}
              />
              <div
                className={cn(
                  'absolute right-[9px] top-[8px] h-5 w-5 rounded-full border border-current/15 transition-all duration-500',
                  isAnimating || isConnected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                )}
              />
            </>
          )}
          {(isAnimating || isConnected) && (
            <div className="absolute inset-0 rounded-2xl bg-unilink-500/10 animate-pulse-glow" />
          )}
          {(isAnimating || isConnected) && (
            <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]" />
          )}
        </div>
      </div>

      <p
        className={cn(
          'text-center text-sm font-medium transition-colors duration-300',
          isReady || isConnected ? 'text-unilink-700' : 'text-slate-500',
        )}
      >
        {statusText}
      </p>
    </div>
  );
};

export default AnimatedToggle;
