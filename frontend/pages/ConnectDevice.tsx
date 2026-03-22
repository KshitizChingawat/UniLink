import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import Logo from "@/components/Logo";
import { toast } from "sonner";

interface PairSessionResponse {
  code: string;
  expiresAt: string;
  accountLabel: string;
}

interface PairClaimResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  device: {
    id: string;
    deviceId: string;
    deviceName: string;
    platform: string;
  };
}

const detectPlatform = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "browser";
};

const detectDeviceType = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone")) return "mobile";
  return "browser";
};

const getOrCreateDeviceId = () => {
  const existing = localStorage.getItem("unilink_device_id");
  if (existing) return existing;
  const next = `browser_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("unilink_device_id", next);
  return next;
};

const defaultDeviceName = () => {
  const platform = detectPlatform();
  const label = platform === "ios" ? "iPhone Browser" : platform === "android" ? "Android Browser" : `${navigator.platform} Browser`;
  return label;
};

const ConnectDevice = () => {
  const [, params] = useRoute("/connect/:code");
  const [, navigate] = useLocation();
  const [session, setSession] = useState<PairSessionResponse | null>(null);
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!params?.code) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch<PairSessionResponse>(`/api/pair-sessions/${params.code}`);
        setSession(data);
      } catch (error) {
        toast.error("This pairing link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [params?.code]);

  const expiresLabel = useMemo(() => {
    if (!session?.expiresAt) return "";
    return new Date(session.expiresAt).toLocaleTimeString();
  }, [session?.expiresAt]);

  const handleConnect = async () => {
    if (!params?.code || !deviceName.trim()) {
      toast.error("Enter a device name to continue.");
      return;
    }

    setClaiming(true);
    try {
      const payload = {
        deviceName: deviceName.trim(),
        deviceType: detectDeviceType(),
        platform: detectPlatform(),
        deviceId: getOrCreateDeviceId(),
      };

      const data = await apiFetch<PairClaimResponse>(`/api/pair-sessions/${params.code}/claim`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      localStorage.setItem("unilink_current_device", JSON.stringify(data.device));
      toast.success("Device connected successfully.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect device.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-white/50 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo size="md" />
          </div>
          <CardTitle className="text-3xl">Connect This Device</CardTitle>
          <CardDescription>
            {loading
              ? "Loading pairing invitation..."
              : session
                ? `Join ${session.accountLabel}'s UniLink network. This invite expires at ${expiresLabel}.`
                : "This invite is no longer available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {session ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="device-name">Device name</Label>
                <Input
                  id="device-name"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  placeholder="My phone browser"
                />
              </div>
              <div className="rounded-2xl border border-unilink-200 bg-unilink-50/80 px-4 py-4 text-sm text-unilink-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                This will securely add this browser as a connected UniLink device and sign it into the paired account.
              </div>
              <Button className="w-full bg-unilink-600 hover:bg-unilink-700" onClick={handleConnect} disabled={claiming}>
                {claiming ? "Connecting device..." : "Connect Device"}
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectDevice;
