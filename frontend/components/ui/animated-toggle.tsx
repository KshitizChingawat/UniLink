import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
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
            'pointer-events-none absolute inset-x-3 top-1/2 h-28 -translate-y-1/2 rounded-full blur-2xl transition-all duration-700',
            isConnected
              ? 'bg-gradient-to-r from-emerald-400/25 via-cyan-400/25 to-unilink-500/25 opacity-100'
              : isReady
                ? 'bg-gradient-to-r from-cyan-400/25 via-unilink-500/20 to-violet-500/25 opacity-100'
                : 'bg-slate-300/20 opacity-60',
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute left-7 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border transition-all duration-700',
            isReady || isAnimating || isConnected
              ? 'scale-110 border-cyan-300/35 opacity-100 shadow-[0_0_42px_rgba(14,165,233,0.18)]'
              : 'scale-90 border-slate-300/30 opacity-0',
          )}
        />
        <button
          type="button"
          aria-label="Start login connection"
          onClick={handleActivate}
          disabled={!canActivate || isAnimating || isConnected}
          className={cn(
            'group relative z-10 flex h-[4.35rem] w-[4.35rem] items-center justify-center overflow-hidden rounded-[1.35rem] border transition-all duration-500',
            isConnected
              ? 'border-emerald-300/80 bg-white text-emerald-600 shadow-[0_18px_55px_rgba(16,185,129,0.26)]'
              : isReady
                ? 'border-cyan-200/90 bg-white text-unilink-600 shadow-[0_16px_42px_rgba(37,99,235,0.2)] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(37,99,235,0.28)]'
                : 'border-slate-200 bg-slate-50 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
          )}
        >
          <div
            className={cn(
              'absolute inset-0 bg-[radial-gradient(circle_at_32%_20%,rgba(255,255,255,0.98),rgba(255,255,255,0.36)_42%,transparent_72%)] transition-opacity duration-500',
              isReady || isConnected ? 'opacity-100' : 'opacity-65',
            )}
          />
          <div className="absolute inset-x-2 top-0 h-px bg-white/90" />
          <div className="absolute -left-8 top-2 h-16 w-16 rounded-full bg-cyan-300/20 blur-xl" />
          <div className="absolute -right-7 bottom-1 h-14 w-14 rounded-full bg-unilink-500/15 blur-xl" />

          <div
            className={cn(
              'absolute inset-3 rounded-full border transition-all duration-700',
              isConnected
                ? 'scale-105 border-emerald-300/65 opacity-100'
                : isReady || isAnimating
                  ? 'scale-100 border-cyan-300/55 opacity-100'
                  : 'scale-90 border-slate-300/40 opacity-55',
            )}
          />
          <div
            className={cn(
              'absolute inset-[0.85rem] rounded-full border border-dashed transition-all duration-700',
              isReady || isAnimating || isConnected
                ? 'animate-[spin_9s_linear_infinite] border-current/25 opacity-100'
                : 'border-current/10 opacity-45',
            )}
          />
          <div
            className={cn(
              'absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-current transition-all duration-700',
              isReady || isAnimating || isConnected
                ? '-translate-x-[1.75rem] -translate-y-[1.75rem] opacity-80 shadow-[0_0_14px_currentColor]'
                : '-translate-x-1/2 -translate-y-1/2 opacity-0',
            )}
          />
          <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(15,23,42,0.08)]">
            {isConnected ? (
              <ShieldCheck className="h-[1.375rem] w-[1.375rem] drop-shadow-[0_0_12px_rgba(16,185,129,0.42)]" strokeWidth={2.2} />
            ) : isAnimating ? (
              <Radio className="h-[1.375rem] w-[1.375rem] animate-pulse drop-shadow-[0_0_12px_rgba(14,165,233,0.45)]" strokeWidth={2.2} />
            ) : (
              <Fingerprint
                className={cn(
                  'h-6 w-6 transition-transform duration-500',
                  isReady ? 'group-hover:scale-110' : '',
                )}
                strokeWidth={1.85}
              />
            )}
          </div>
          {(isReady || isAnimating || isConnected) && (
            <div className="absolute inset-x-3 top-2 h-8 overflow-hidden rounded-full">
              <div className="h-full w-full animate-[login-scan_2.3s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-cyan-300/45 to-transparent" />
            </div>
          )}
          {(isReady || isConnected) && (
            <>
              <div className="absolute inset-0 rounded-[1.35rem] bg-cyan-400/10 animate-pulse-glow" />
              <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.2)_35%,rgba(255,255,255,0.78)_50%,rgba(255,255,255,0.2)_65%,transparent_100%)] animate-shimmer" />
            </>
          )}
        </button>

        <div className="relative mx-3 h-9 w-28 overflow-hidden rounded-full border border-white/70 bg-white/55 shadow-[inset_0_1px_2px_rgba(15,23,42,0.1),0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-md sm:w-32">
          <div className="absolute inset-x-3 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-slate-200/95 shadow-[inset_0_1px_3px_rgba(15,23,42,0.16)]" />
          <div className="absolute inset-x-3 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0))]" />
          <div
            className={cn(
              'absolute left-3 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-unilink-500 to-violet-500 transition-all duration-700',
              isAnimating || isConnected ? 'w-full opacity-100' : 'w-0 opacity-0',
            )}
            style={{ maxWidth: 'calc(100% - 1.5rem)' }}
          />
          {(isAnimating || isConnected) && (
            <div className="absolute left-2 top-1/2 h-7 w-14 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92),rgba(125,211,252,0.48)_42%,transparent_72%)] blur-[2px] animate-[energy-pass_1.25s_ease-in-out_infinite]" />
          )}
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
            <>
              <div className="absolute left-5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.85)]" />
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75 shadow-[0_0_12px_rgba(255,255,255,0.75)]" />
              <Zap className="absolute left-[0.82rem] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]" strokeWidth={2.4} />
              <Sparkles className="absolute right-[0.82rem] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-500 drop-shadow-[0_0_10px_rgba(139,92,246,0.65)]" strokeWidth={2.2} />
              <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_0_20px_rgba(255,255,255,0.95)]" style={{ left: 'calc(100% - 1.4rem)' }} />
            </>
          )}
        </div>

        <div
          className={cn(
            'relative z-10 flex h-[4.35rem] w-[4.35rem] items-center justify-center overflow-hidden rounded-[1.35rem] border transition-all duration-500',
            isConnected
              ? 'border-emerald-300/80 bg-white text-emerald-600 shadow-[0_18px_55px_rgba(16,185,129,0.26)]'
              : isAnimating
                ? 'border-cyan-200/90 bg-white text-unilink-500 shadow-[0_14px_36px_rgba(37,99,235,0.18)]'
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
          {isConnected ? (
            <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 rounded-full bg-white text-emerald-500 shadow-[0_0_12px_rgba(74,222,128,0.75)]" strokeWidth={2.5} />
          ) : (
            (isAnimating || isReady) && (
              <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]" />
            )
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
