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

const App = () => {
  return (
    <AuthProvider>
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
