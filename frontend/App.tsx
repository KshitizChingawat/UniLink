import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Pricing from "@/pages/Pricing";
import Security from "@/pages/Security";
import Support from "@/pages/Support";
import Product from "@/pages/Product";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import ConnectDevice from "@/pages/ConnectDevice";
import NotFound from "@/pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/useBackendHealth";

const WakeUpBanner = () => {
  const { status, attempts } = useBackendHealth();

  if (status === 'ready' || status === 'checking') return null;

  if (status === 'error') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 shadow-lg text-sm text-red-700">
        <span className="text-base">⚠️</span>
        <span>Server unavailable. Please try again in a moment.</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-xl border border-blue-200 bg-white px-5 py-3 shadow-lg text-sm text-gray-700">
      <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3H4a8 8 0 01-8-8z" />
      </svg>
      <span>
        Server is waking up{attempts > 3 ? " (this can take ~30 seconds on free tier)" : "…"}
      </span>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <WakeUpBanner />
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/connect/:code" component={ConnectDevice} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/:section" component={Dashboard} />
        <Route path="/dashboard/:section/:rest" component={Dashboard} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/security" component={Security} />
        <Route path="/support" component={Support} />
        <Route path="/product" component={Product} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
};

export default App;
