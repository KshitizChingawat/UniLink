
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut } from 'lucide-react';
import DownloadButton from './DownloadButton';
import Logo from './Logo';
import { useAuth } from '@/hooks/useAuth';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const [location, navigate] = useLocation();
  const { user, signOut } = useAuth();

  const displayName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const navItems = useMemo(() => ([
    { label: 'Features', type: 'section', value: 'features' },
    { label: 'Compatibility', type: 'section', value: 'compatibility' },
    { label: 'Security', type: 'route', value: '/security' },
    { label: 'Pricing', type: 'route', value: '/pricing' },
  ]), []);

  useEffect(() => {
    const syncHash = () => {
      setActiveHash(window.location.hash);
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);

    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, []);

  useEffect(() => {
    if (location !== '/') {
      setActiveHash('');
      return;
    }

    setActiveHash(typeof window !== 'undefined' ? window.location.hash : '');
  }, [location]);

  const isActive = (item: { type: string; value: string }) => {
    if (item.type === 'section') {
      return location === '/' && activeHash === `#${item.value}`;
    }
    return location === item.value;
  };

  const goToSection = (sectionId: string) => {
    setActiveHash(`#${sectionId}`);
    if (location !== '/') {
      navigate(`/#${sectionId}`);
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      setIsMenuOpen(false);
      return;
    }

    window.history.replaceState({}, '', `/#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/">
            <Logo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center space-x-3">
            {navItems.map((item) => (
              item.type === 'section' ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => goToSection(item.value)}
                  className={`rounded-full px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.22em] transition-all duration-300 ${
                    isActive(item)
                      ? 'bg-unilink-50 text-unilink-700 shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-unilink-600'
                  }`}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.value}
                  className={`rounded-full px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.22em] transition-all duration-300 ${
                    isActive(item)
                      ? 'bg-unilink-50 text-unilink-700 shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-unilink-600'
                  }`}
                >
                  {item.label}
                </Link>
              )
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <Link to="/dashboard">
                  <Button variant="outline" className="text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 hover:text-unilink-600">
                    Dashboard
                  </Button>
                </Link>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-100">Welcome, {displayName}</span>
                <Button variant="ghost" onClick={signOut} className="text-gray-700 dark:text-slate-100 dark:hover:bg-slate-800 hover:text-unilink-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-700 dark:text-slate-100 dark:hover:bg-slate-800 hover:text-unilink-600">
                    Sign In
                  </Button>
                </Link>
                <DownloadButton className="bg-unilink-600 hover:bg-unilink-700 text-white" />
              </>
            )}
          </div>

          <button
            className="md:hidden text-slate-800 dark:text-slate-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-slate-800 dark:bg-slate-950">
            <nav className="flex flex-col space-y-4">
              <button type="button" className="text-left text-gray-700 dark:text-slate-200 hover:text-unilink-600" onClick={() => goToSection('features')}>Features</button>
              <button type="button" className="text-left text-gray-700 dark:text-slate-200 hover:text-unilink-600" onClick={() => goToSection('compatibility')}>Compatibility</button>
              <Link to="/security" className="text-gray-700 dark:text-slate-200 hover:text-unilink-600" onClick={() => setIsMenuOpen(false)}>Security</Link>
              <Link to="/pricing" className="text-gray-700 dark:text-slate-200 hover:text-unilink-600" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
              <div className="flex flex-col space-y-2 pt-4">
                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="justify-start w-full dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">Dashboard</Button>
                    </Link>
                    <Button variant="ghost" onClick={signOut} className="justify-start w-full dark:text-slate-100 dark:hover:bg-slate-800">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" className="justify-start w-full dark:text-slate-100 dark:hover:bg-slate-800">Sign In</Button>
                    </Link>
                    <DownloadButton className="bg-unilink-600 hover:bg-unilink-700 text-white" />
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
