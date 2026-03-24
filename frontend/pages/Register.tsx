
import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import { toast } from 'sonner';

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

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const { signUp, signInWithGoogle } = useAuth();

  const passwordRules = [
    {
      label: 'Password must be at least 8 characters',
      valid: formData.password.length >= 8,
    },
    {
      label: 'Include at least one special symbol',
      valid: /[^A-Za-z0-9]/.test(formData.password),
    },
  ];

  const isPasswordValid = passwordRules.every((rule) => rule.valid);
  const normalizedEmail = formData.email.trim().toLowerCase();
  const emailLooksValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) &&
    !blockedEmailDomains.has(normalizedEmail.split('@')[1] || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailLooksValid) {
      toast.error('Enter a valid email address');
      return;
    }

    if (!isPasswordValid) {
      toast.error('Password must be at least 8 characters and include a special symbol.');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      toast.error('Please agree to the Terms of Service and Privacy Policy');
      return;
    }
    
    setLoading(true);
    
    const result = await signUp(formData.email, formData.password, formData.firstName, formData.lastName);
    
    setLoading(false);
    
    // Clear form on successful registration
    if (!result.error) {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      setAgreedToTerms(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGoogleRegister = async () => {
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
        {/* Register Card */}
        <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/40 dark:border-slate-700">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
            <p className="text-gray-600 dark:text-slate-300 mt-2">Join thousands of users connecting their devices without range restrictions</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="John"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe"
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="john@example.com"
                className="mt-1"
                autoComplete="email"
                required
              />
              {formData.email && !emailLooksValid && (
                <p className="mt-2 text-sm text-red-600">Enter a valid email address</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Create a strong password"
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
              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${rule.valid ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className={rule.valid ? 'text-green-700' : 'text-red-600'}>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* UniLink Features */}
            <div className="bg-gray-50 rounded-lg p-4 dark:bg-slate-800/70">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">UniLink Features:</p>
              <div className="space-y-1">
                {[
                  'Connect devices without range restrictions',
                  'Secure end-to-end encryption',
                  'Cross-platform compatibility',
                  'Real-time file sharing'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <Check className="w-3 h-3 text-green-500 mr-2" />
                    <span className="text-gray-600 dark:text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-gray-600 dark:text-slate-300">
                I agree to the{' '}
                <Link to="/terms" className="text-unilink-600 hover:text-unilink-700">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-unilink-600 hover:text-unilink-700">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-unilink-600 hover:bg-unilink-700"
              disabled={loading || !agreedToTerms || !isPasswordValid}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-unilink-600 hover:text-unilink-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>

          {/* Social Registration */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-300">Or sign up with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleRegister} disabled={loading}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="w-full" onClick={() => toast.info('Facebook signup is coming soon.')}>
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

export default Register;
