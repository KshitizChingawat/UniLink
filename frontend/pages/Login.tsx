
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
import LoginSignalScene from '@/components/login/LoginSignalScene';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';

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
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
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

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error('Enter your email address first.');
      return;
    }

    setForgotLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      toast.success(data.message);
      setForgotOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start password reset support.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#06111f] px-3 py-4 font-['Bahnschrift','Segoe_UI',sans-serif] sm:px-4 sm:py-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(14,165,233,0.34),transparent_32%),linear-gradient(135deg,#071527_0%,#10375c_42%,#16203c_72%,#2c1651_100%)]">
        <LoginSignalScene />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.12)_0%,transparent_22%,transparent_68%,rgba(56,189,248,0.16)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.16)_54%,rgba(2,6,23,0.58)_100%)]" />
        <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>
      <div className="relative z-10 flex w-full max-w-[27rem] items-center justify-center">
        {/* Login Card */}
        <div className="relative flex w-full flex-col justify-center overflow-hidden rounded-[1.35rem] border border-white/55 bg-white/[0.92] px-5 py-4 shadow-[0_28px_90px_rgba(2,6,23,0.34)] backdrop-blur-2xl sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-cyan-200/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-8 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl" />
          {/* Logo */}
          <div className="mb-3.5 text-center sm:mb-5">
            <div className="mb-2 flex justify-center sm:mb-2.5">
              <Logo size="md" showText={false} />
            </div>
            
            <h1 className="text-[1.55rem] font-black leading-tight text-slate-950 sm:text-[2rem]">Welcome back</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 sm:mt-1.5 sm:text-[15px]">Sign in to your UniLink account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
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
                className="mt-1"
                autoComplete="email"
                required
              />
              <datalist id="remembered-emails">
                {rememberedAccounts.map((account) => (
                  <option key={account.email} value={account.email} />
                ))}
              </datalist>
              {!emailLooksValid && (
                <p className="mt-2 text-sm text-red-600">Enter a valid email address</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                <Label htmlFor="remember-me" className="text-sm text-gray-600">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotOpen(true);
                }}
                className="text-sm font-medium text-unilink-600 transition-colors hover:text-unilink-700"
              >
                Forgot password?
              </button>
            </div>

            <div className="rounded-[1.15rem] border border-cyan-200/70 bg-[linear-gradient(145deg,rgba(239,246,255,0.92),rgba(255,255,255,0.62))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_18px_45px_rgba(37,99,235,0.12)] sm:px-4 sm:py-3.5">
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
            <p className="text-sm text-gray-600 sm:text-base">
              Don't have an account?{' '}
              <Link to="/register" className="text-unilink-600 hover:text-unilink-700 font-semibold">
                Sign up
              </Link>
            </p>
          </div>

          {/* Social Login */}
          <div className="mt-3.5 sm:mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-3.5 sm:gap-3">
              <Button variant="outline" type="button" className="h-9 w-full text-sm sm:h-10" onClick={handleGoogleLogin} disabled={loading}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="h-9 w-full text-sm sm:h-10" onClick={() => toast.info('Facebook login is coming soon.')}>
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
            <DialogTitle>Reset password support</DialogTitle>
            <DialogDescription>
              Enter your account email and we&apos;ll start the password reset support flow for UniLink.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email address</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? 'Sending...' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
