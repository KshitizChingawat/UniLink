import { useLocation, Route, Switch } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardHome from '@/components/dashboard/DashboardHome';
import DevicesPage from '@/components/dashboard/DevicesPage';
import ClipboardPage from '@/components/dashboard/ClipboardPage';
import FileTransferPage from '@/components/dashboard/FileTransferPage';
import AnalyticsPage from '@/components/dashboard/AnalyticsPage';
import SecurityPage from '@/components/dashboard/SecurityPage';
import SettingsPage from '@/components/dashboard/SettingsPage';
import SmartSyncDashboard from '@/components/dashboard/SmartSyncDashboard';

const Dashboard = () => {
  const { user, loading, sessionUnavailable, retrySession } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user && !sessionUnavailable) {
      navigate('/login');
    }
  }, [user, loading, sessionUnavailable, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-unilink-600" />
      </div>
    );
  }

  if (sessionUnavailable) {
    return (
      <main className="min-h-screen grid place-content-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">We couldn’t check your session</h1>
        <p>Your sign-in is saved. Check your connection and try again.</p>
        <Button className="justify-self-center" onClick={retrySession}>Try again</Button>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard" component={DashboardHome} />
        <Route path="/dashboard/devices" component={DevicesPage} />
        <Route path="/dashboard/clipboard" component={ClipboardPage} />
        <Route path="/dashboard/files" component={FileTransferPage} />
        <Route path="/dashboard/analytics" component={AnalyticsPage} />
        <Route path="/dashboard/security" component={SecurityPage} />
        <Route path="/dashboard/settings" component={SettingsPage} />
        <Route path="/dashboard/smart-sync" component={SmartSyncDashboard} />
      </Switch>
    </DashboardLayout>
  );
};

export default Dashboard;
