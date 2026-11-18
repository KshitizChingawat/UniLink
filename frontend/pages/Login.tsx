
import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import AnimatedToggle from '@/components/ui/animated-toggle';
import GenerativeArtSceneV3 from '@/components/ui/quantum-nebula';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const blockedEmailDomains = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'invalid.com',
  'fake.com',
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'yopmail.com',
  'guerrillamail.com',
  'sharklasers.com',
]);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember-me') === 'true');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const { signIn, requestPasswordReset, resetPassword } = useAuth();
  const normalizedEmail = email.trim().toLowerCase();
  const emailLooksValid =
    !email || (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) &&
      !blockedEmailDomains.has(normalizedEmail.split('@')[1] || '')
    );

  const performLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Enter your email and password to continue.');
      return false;
    }

    if (!emailLooksValid) {
      toast.error('Enter a valid email address');
      return false;
    }

    setLoading(true);
    const result = await signIn(email, password, rememberMe);
    setLoading(false);

    if (!result.error) {
      setEmail('');
      setPassword('');
      setRememberMe(false);
      return true;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin();
  };

  const openForgotDialog = () => {
    setForgotEmail(email);
    setForgotStep('email');
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setForgotOpen(true);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error('Enter your email address first.');
      return;
    }

    setForgotLoading(true);
    const result = await requestPasswordReset(forgotEmail);
    setForgotLoading(false);
    if (result.error) {
      return;
    }
    // A resend issues a FRESH code, so drop any previously typed one.
    setResetOtp('');
    setForgotStep('reset');
  };

  const handleResetPassword = async () => {
    if (resetOtp.trim().length !== 6) {
      toast.error('Enter the 6-digit reset code.');
      return;
    }
    if (newPassword.length < 8 || !/[^A-Za-z0-9]/.test(newPassword)) {
      toast.error('Password must be at least 8 characters and include a special symbol.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setResettingPassword(true);
    const result = await resetPassword(forgotEmail, resetOtp.trim(), newPassword, confirmNewPassword);
    setResettingPassword(false);
    if (!result.error) {
      setEmail(forgotEmail.trim());
      setPassword('');
      setForgotOpen(false);
      setForgotStep('email');
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#06111f] px-3 py-4 font-['Bahnschrift','Segoe_UI',sans-serif] sm:px-4 sm:py-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(6,172,241,0.4),transparent_32%),linear-gradient(160deg,#071527_0%,#10375c_42%,#16203c_72%,#2c1651_100%)]">
        <GenerativeArtSceneV3 />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(6,172,241,0.15)_0%,transparent_22%,transparent_68%,rgba(56,189,248,0.2)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.25)_54%,rgba(2,6,23,0.7)_100%)]" />
      </div>
      <div className="relative z-10 flex w-full max-w-[27rem] items-center justify-center">
        {/* Login Card */}
        <div 
          className="relative flex w-full flex-col justify-center overflow-hidden rounded-[1.35rem] border border-white/20 bg-black/[0.45] px-5 py-4 shadow-[0_8px_32px_rgba(6,172,241,0.15)] backdrop-blur-xl sm:px-6 sm:py-5"
          style={{
            '--background': '222.2 47.4% 11.2%',
            '--foreground': '210 40% 98%',
            '--card': '222.2 47.4% 14.2%',
            '--card-foreground': '210 40% 98%',
            '--border': '217.2 32.6% 21.5%',
            '--input': '217.2 32.6% 21.5%',
            '--ring': '221.2 83.2% 53.3%',
            '--primary': '221.2 83.2% 53.3%',
          } as React.CSSProperties}
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.4),transparent)]" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-8 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl" />
          {/* Frosted glass inner glow */}
          <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06)_0%,transparent_60%),radial-gradient(ellipse_at_bottom,rgba(147,51,234,0.05)_0%,transparent_60%)]" />
          {/* Logo */}
          <div className="mb-3.5 text-center sm:mb-5">
            <div className="mb-2 flex justify-center sm:mb-2.5">
              <Logo size="md" showText={false} />
            </div>
            
            <h1 id="auth-title" className="text-[1.55rem] font-black leading-tight text-white sm:text-[2rem]">Welcome back</h1>
            <p className="mt-1 text-sm font-medium text-slate-300 sm:mt-1.5 sm:text-[15px]">Sign in to your UniLink account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1 bg-white/5 border border-white/20 placeholder:text-slate-500/50 focus:border-sky-400/50 text-white disabled:cursor-not-allowed md:text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                autoComplete="email"
                required
              />
              {!emailLooksValid && (
                <p className="mt-2 text-sm text-red-400">Enter a valid email address</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-white/5 border border-white/20 placeholder:text-slate-500/50 focus:border-sky-400/50 text-white disabled:cursor-not-allowed md:text-sm pr-10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                  <Label htmlFor="remember-me" className="text-sm text-slate-300">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={openForgotDialog}
                className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
              >
                Forgot password?
              </button>
            </div>

            <div className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_45px_rgba(6,172,241,0.12)] sm:px-4 sm:py-3.5">
              <AnimatedToggle
                canActivate={Boolean(email.trim() && password.trim())}
                isSubmitting={loading}
                idleLabel="Enter your credentials to power the link"
                readyLabel="Tap the left module to sign in"
                successLabel="UniLink connected. Logging you in..."
                onActivate={performLogin}
                className="mx-auto w-full gap-2 sm:gap-2.5"
              />
            </div>
            <button type="submit" className="sr-only focus:not-sr-only focus:text-white" disabled={loading}>Sign in</button>
          </form>

          <div className="mt-3.5 text-center sm:mt-4">
            <p className="text-sm text-gray-300 sm:text-base">
              Don't have an account?{' '}
              <Link to="/register" className="text-sky-400 hover:text-sky-300 font-semibold">
                Sign up
              </Link>
            </p>
          </div>

        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              {forgotStep === 'email'
                ? 'Enter your account email and we will send you a 6-digit reset code.'
                : 'Enter the reset code and choose a new password.'}
            </DialogDescription>
          </DialogHeader>
          {forgotStep === 'email' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1"
                />
              </div>
              <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:space-x-0">
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleForgotPassword} disabled={forgotLoading}>
                  {forgotLoading ? 'Sending...' : 'Send reset code'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Resetting password for <span className="font-semibold">{forgotEmail}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-otp">6-digit reset code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reset-otp"
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? 'Sending...' : 'Resend'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    If the email is registered, check your inbox and spam folder for the latest code.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars + special symbol"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showNewPassword ? 'Hide password' : 'Review password'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="reset-confirm-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showConfirmNewPassword ? 'Hide password' : 'Review password'}
                    >
                      {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:space-x-0">
                <Button type="button" variant="outline" onClick={() => setForgotStep('email')}>
                  Back
                </Button>
                <Button type="button" onClick={handleResetPassword} disabled={resettingPassword}>
                  {resettingPassword ? 'Resetting...' : 'Reset password'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
