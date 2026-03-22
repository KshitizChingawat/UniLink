
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
import { toast } from 'sonner';

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
  const { signIn, signInWithGoogle } = useAuth();

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-unilink-600 via-blue-600 to-purple-600 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full bg-white/10 blur-2xl animate-float" />
        <div className="absolute right-[10%] top-[20%] h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-[12%] left-[16%] h-48 w-48 rounded-full bg-indigo-200/20 blur-3xl animate-float" style={{ animationDelay: '1.4s' }} />
        <div className="absolute bottom-[8%] right-[14%] h-44 w-44 rounded-full bg-white/10 blur-2xl animate-pulse-glow" style={{ animationDelay: '2.1s' }} />
      </div>
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/40 dark:border-slate-700">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-gray-600 dark:text-slate-300 mt-2">Sign in to your UniLink account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    setPassword('');
                    setRememberMe(false);
                  }
                }}
                onFocus={() => {
                  if (email && rememberedAccounts.some((account) => account.email === email)) {
                    hydrateRememberedAccount(email);
                  }
                }}
                placeholder="Enter your email"
                className="mt-1"
                required
              />
              <datalist id="remembered-emails">
                {rememberedAccounts.map((account) => (
                  <option key={account.email} value={account.email} />
                ))}
              </datalist>
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

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember-me" className="text-sm text-gray-600 dark:text-slate-300">
                  Remember me
                </Label>
              </div>
              <span className="text-sm text-blue-100/0 text-unilink-600">Secure access</span>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-5 dark:border-slate-700 dark:bg-slate-800/60">
              <AnimatedToggle
                canActivate={Boolean(email.trim() && password.trim())}
                isSubmitting={loading}
                idleLabel="Enter your credentials to power the link"
                readyLabel="Tap the left module to sign in"
                successLabel="UniLink connected. Logging you in..."
                onActivate={performLogin}
              />
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-unilink-600 hover:text-unilink-700 font-semibold">
                Sign up
              </Link>
            </p>
          </div>

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-300">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="w-full" onClick={() => toast.info('Facebook login is coming soon.')}>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
