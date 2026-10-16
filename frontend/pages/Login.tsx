
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
  const rememberedAccounts = JSON.parse(localStorage.getItem('saved_login_accounts') || '[]') as Array<{
    email: string;
    password: string;
    lastUsed: string;
  }>;
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  const [resetDevelopmentOtp, setResetDevelopmentOtp] = useState('');
  const [resetDeliveryMode, setResetDeliveryMode] = useState<'email' | 'fallback' | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetServerWarning, setResetServerWarning] = useState<string | null>(null);
  const [resetMailProvider, setResetMailProvider] = useState<'mailtrap-api' | 'smtp' | 'none' | null>(null);
  const { signIn, signInWithGoogle, requestPasswordReset, resetPassword, getEmailStatus } = useAuth();
  const normalizedEmail = email.trim().toLowerCase();
  const emailLooksValid =
    !email || (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) &&
      !blockedEmailDomains.has(normalizedEmail.split('@')[1] || '')
    );

  const hydrateRememberedAccount = (selectedEmail: string) => {
    const selected = rememberedAccounts.find((account) => account.email === selectedEmail);
    if (!selected) return;
    setEmail(selected.email);
    setPassword(selected.password);
    setRememberMe(true);
  };

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

  const handleGoogleLogin = async () => {
    const googleEmail = window.prompt('Enter your Google Gmail address');
    if (!googleEmail) {
      return;
    }

    setLoading(true);
    await signInWithGoogle(googleEmail, true);
    setLoading(false);
  };

  const openForgotDialog = () => {
    setForgotEmail(email);
    setForgotStep('email');
    setResetOtp('');
    setResetDevelopmentOtp('');
    setResetDeliveryMode(null);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setResetServerWarning(null);
    setResetMailProvider(null);
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
    setResetDevelopmentOtp(result.developmentOtp || '');
    setResetDeliveryMode(result.deliveryMode || 'email');
    setResetServerWarning(null);
    setResetMailProvider(null);
    // The server answered success but supplied no on-screen code: find out
    // why so the user isn't left waiting for mail that can't arrive.
    if (!result.developmentOtp) {
      const status = await getEmailStatus();
      if (status && !status.emailConfigured) {
        setResetServerWarning(
          'Server email delivery is off and no temporary code was provided. Press Resend to request a temporary code.',
        );
      } else if (!status) {
        setResetServerWarning(
          'The server did not provide a reset code. It may be running an older version — please try again after it updates.',
        );
      } else {
        // Email path: remember the provider so the hint points at the right inbox.
        setResetMailProvider(status.provider || null);
      }
    }
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
            
            <h1 className="text-[1.55rem] font-black leading-tight text-white sm:text-[2rem]">Welcome back</h1>
            <p className="mt-1 text-sm font-medium text-slate-300 sm:mt-1.5 sm:text-[15px]">Sign in to your UniLink account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                list="remembered-emails"
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (rememberedAccounts.some((account) => account.email === e.target.value)) {
                    hydrateRememberedAccount(e.target.value);
                  } else {
                    // setPassword('');
                    // setRememberMe(false);
                  }
                }}
                onFocus={() => {
                  if (email && rememberedAccounts.some((account) => account.email === email)) {
                    hydrateRememberedAccount(email);
                  }
                }}
                placeholder="Enter your email"
                className="mt-1 bg-white/5 border border-white/20 placeholder:text-slate-500/50 focus:border-sky-400/50 text-white disabled:cursor-not-allowed md:text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                autoComplete="email"
                required
              />
              <datalist id="remembered-emails">
                {rememberedAccounts.map((account) => (
                  <option key={account.email} value={account.email} />
                ))}
              </datalist>
              {!emailLooksValid && (
                <p className="mt-2 text-sm text-red-400">Enter a valid email address</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
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
                className="gap-2 scale-[0.9] sm:gap-2.5 sm:scale-[0.97]"
              />
            </div>
          </form>

          <div className="mt-3.5 text-center sm:mt-4">
            <p className="text-sm text-gray-300 sm:text-base">
              Don't have an account?{' '}
              <Link to="/register" className="text-sky-400 hover:text-sky-300 font-semibold">
                Sign up
              </Link>
            </p>
          </div>

          {/* Social Login */}
          <div className="mt-3.5 sm:mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black/[0.45] text-gray-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-3.5 sm:gap-3">
              <Button variant="outline" type="button" className="h-9 w-full border-gray-600 bg-black/[0.3] text-gray-200 hover:bg-gray-800/50 text-sm sm:h-10" onClick={handleGoogleLogin} disabled={loading}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="h-9 w-full border-gray-600 bg-black/[0.3] text-gray-200 hover:bg-gray-800/50 text-sm sm:h-10" onClick={() => toast.info('Facebook login is coming soon.')}>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </Button>
            </div>
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
              <DialogFooter>
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
                {resetServerWarning && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    {resetServerWarning}
                  </div>
                )}
                {resetDeliveryMode === 'fallback' && resetDevelopmentOtp && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Temporary reset code</p>
                    <p className="mt-1">Email delivery is unavailable right now. Use this code:</p>
                    <div className="mt-2 rounded-md bg-white px-3 py-2 text-base font-bold tracking-[0.35em] text-amber-700">
                      {resetDevelopmentOtp}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reset-otp">6-digit reset code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reset-otp"
                      type="text"
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
                    {resetDeliveryMode === 'email' && resetMailProvider === 'mailtrap-api'
                      ? 'The code was sent to your Mailtrap test inbox — open the Mailtrap dashboard, not Gmail. Sandbox mail never reaches real inboxes.'
                      : resetDeliveryMode === 'email'
                        ? 'Check your inbox (and spam folder) for the code.'
                        : 'Each resend generates a fresh code and invalidates the previous one.'}
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
              <DialogFooter>
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
