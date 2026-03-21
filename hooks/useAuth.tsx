
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Check for existing token in localStorage
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Invalid credentials') {
          toast.error('Invalid email or password. Please try again or sign up.');
          return { error: new Error(data.error), shouldRedirect: false };
        } else {
          toast.error(data.error || 'Sign in failed');
          return { error: new Error(data.error) };
        }
      }

      // Store token and user data
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      if (rememberMe) {
        localStorage.setItem('remember-me', 'true');
      } else {
        localStorage.removeItem('remember-me');
      }
      
      setUser(data.user);
      
      // Small delay to ensure state is set before navigation
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
      
      return { error: null };
    } catch (err) {
      toast.error('An unexpected error occurred');
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Sign up failed');
        return { error: new Error(data.error) };
      }

      // Store token and user data
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      toast.success('Account created and signed in successfully!');
      
      // Small delay to ensure state is set before navigation
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
      
      return { error: null };
    } catch (err) {
      toast.error('An unexpected error occurred during registration');
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('remember-me');
      
      setUser(null);
      toast.success('Signed out successfully');
      navigate('/');
      
      return { success: true };
    } catch (error: any) {
      toast.error('Sign out failed');
      return { error };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
};
