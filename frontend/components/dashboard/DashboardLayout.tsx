
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  LayoutDashboard,
  Smartphone, 
  Clipboard, 
  Send, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Shield,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const displayName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const proActive = user?.plan === 'pro' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() > Date.now());

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Devices', href: '/dashboard/devices', icon: Smartphone },
    { name: 'Clipboard', href: '/dashboard/clipboard', icon: Clipboard },
    { name: 'File Transfer', href: '/dashboard/files', icon: Send },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Security', href: '/dashboard/security', icon: Shield },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location === '/';
    }
    if (path === '/dashboard') {
      return location === '/dashboard' || location === '/dashboard/';
    }
    return location?.startsWith?.(path) || false;
  };

  return (
    <div className="dashboard-shell min-h-screen bg-gray-50 dark:bg-slate-950 flex transition-colors duration-300">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        dashboard-sidebar fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="dashboard-border flex items-center justify-between p-4 border-b">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User info */}
          <div className="dashboard-border p-4 border-b">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-unilink-100 rounded-full flex items-center justify-center">
                <span className="text-unilink-600 font-semibold">
                  {displayName[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 truncate">User</p>
                  {proActive ? (
                    <Badge className="border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-400/15 dark:text-amber-300">
                      Pro
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive(item.href) 
                      ? 'bg-unilink-100 text-unilink-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                  {item.name === 'Security' && proActive && (
                    <Badge variant="secondary" className="ml-auto">
                      Pro
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="dashboard-border p-4 border-t">
            <div className="space-y-2">
              <Link
                to="/dashboard/settings"
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <Button
                variant="ghost"
                onClick={signOut}
                className="w-full justify-start text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="dashboard-main flex-1 lg:ml-0">
        {/* Mobile header */}
        <div className="dashboard-mobile-header lg:hidden bg-white dark:bg-slate-950 border-b px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Logo size="sm" />
          <div></div> {/* Spacer for center alignment */}
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
