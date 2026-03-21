
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut } from 'lucide-react';
import DownloadButton from './DownloadButton';
import Logo from './Logo';
import { useAuth } from '@/hooks/useAuth';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/">
            <Logo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/#features" 
              className={`transition-colors ${isActive('/') ? 'text-unilink-600' : 'text-gray-700 hover:text-unilink-600'}`}
            >
              Features
            </Link>
            <Link 
              to="/#compatibility" 
              className={`transition-colors ${isActive('/') ? 'text-unilink-600' : 'text-gray-700 hover:text-unilink-600'}`}
            >
              Compatibility
            </Link>
            <Link 
              to="/security" 
              className={`transition-colors ${isActive('/security') ? 'text-unilink-600' : 'text-gray-700 hover:text-unilink-600'}`}
            >
              Security
            </Link>
            <Link 
              to="/pricing" 
              className={`transition-colors ${isActive('/pricing') ? 'text-unilink-600' : 'text-gray-700 hover:text-unilink-600'}`}
            >
              Pricing
            </Link>
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <Link to="/dashboard">
                  <Button variant="outline" className="text-gray-700 hover:text-unilink-600">
                    Dashboard
                  </Button>
                </Link>
                <span className="text-sm text-gray-700">Welcome, {user.email}</span>
                <Button variant="ghost" onClick={signOut} className="text-gray-700 hover:text-unilink-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-700 hover:text-unilink-600">
                    Sign In
                  </Button>
                </Link>
                <DownloadButton className="bg-unilink-600 hover:bg-unilink-700 text-white" />
              </>
            )}
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              <Link 
                to="/#features" 
                className="text-gray-700 hover:text-unilink-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                to="/#compatibility" 
                className="text-gray-700 hover:text-unilink-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Compatibility
              </Link>
              <Link 
                to="/security" 
                className="text-gray-700 hover:text-unilink-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Security
              </Link>
              <Link 
                to="/pricing" 
                className="text-gray-700 hover:text-unilink-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <div className="flex flex-col space-y-2 pt-4">
                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="justify-start w-full">Dashboard</Button>
                    </Link>
                    <Button variant="ghost" onClick={signOut} className="justify-start w-full">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" className="justify-start w-full">Sign In</Button>
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
