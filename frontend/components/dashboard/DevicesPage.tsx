
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Laptop, Tablet, Globe, Plus, Settings, Trash2 } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useState } from 'react';

interface PairSession {
  code: string;
  expiresAt: string;
  connectUrl: string;
}

const DevicesPage = () => {
  const { devices, currentDevice, loading, removeDevice, updateDeviceStatus } = useDevices();
  const [pairSession, setPairSession] = useState<PairSession | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const connectLink = pairSession?.connectUrl || '';

  const createPairSession = async () => {
    setPairLoading(true);
    try {
      const session = await apiFetch<PairSession>('/api/pair-sessions', {
        method: 'POST',
      });
      setPairSession(session);
    } catch (error) {
      toast.error('Failed to create a pairing invite.');
    } finally {
      setPairLoading(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-6 h-6" />;
      case 'tablet': return <Tablet className="w-6 h-6" />;
      case 'desktop': return <Laptop className="w-6 h-6" />;
      case 'browser': return <Globe className="w-6 h-6" />;
      default: return <Laptop className="w-6 h-6" />;
    }
  };

  const getPlatformBadge = (platform: string) => {
    const colors = {
      windows: 'bg-blue-100 text-blue-800',
      macos: 'bg-gray-100 text-gray-800',
      linux: 'bg-orange-100 text-orange-800',
      android: 'bg-green-100 text-green-800',
      ios: 'bg-blue-100 text-blue-800',
      browser: 'bg-purple-100 text-purple-800'
    };
    
    return colors[platform as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Connected Devices</h1>
          <p className="text-gray-600 mt-2">Manage your device connections and settings</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={createPairSession}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a New Device</DialogTitle>
              <DialogDescription>
                Use this secure invite link on the device you want to connect, or scan the QR code below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {pairSession ? (
                <div className="space-y-4">
                  <div className="mx-auto w-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(connectLink)}`}
                      alt="UniLink device pairing QR code"
                      className="h-56 w-56 rounded-2xl"
                    />
                  </div>
                  <p className="text-center text-sm text-gray-500">
                    Expires at {new Date(pairSession.expiresAt).toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  {pairLoading ? 'Generating secure device invite...' : 'Create an invite to display a pairing QR code.'}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Connection Link</p>
                <div className="flex gap-2">
                  <Input value={connectLink} readOnly placeholder="Generate a secure pairing invite" />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!connectLink}
                    onClick={() => {
                      navigator.clipboard.writeText(connectLink);
                      toast.success('Connection link copied.');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No devices connected</h3>
            <p className="text-gray-600 mb-4">
              Start by creating a pairing invite and opening it on another device.
            </p>
            <Button onClick={createPairSession}>
              <Plus className="w-4 h-4 mr-2" />
              Create Pairing Invite
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {devices.map((device) => (
            <Card key={device.id} className={device.id === currentDevice?.id ? 'border-unilink-500 bg-unilink-50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-unilink-600">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{device.deviceName}</span>
                        {device.id === currentDevice?.id && (
                          <Badge variant="secondary" className="bg-unilink-100 text-unilink-800">
                            Current Device
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {device.deviceType} • {device.platform}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPlatformBadge(device.platform)}>
                      {device.platform}
                    </Badge>
                    <div className={`w-3 h-3 rounded-full ${device.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">
                      {device.isActive ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Seen</p>
                    <p className="font-medium">
                      {device.lastSeen ? new Date(device.lastSeen).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Added</p>
                    <p className="font-medium">
                      {new Date(device.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Security</p>
                    <p className="font-medium text-green-600">
                      {device.publicKey ? 'Encrypted' : 'Basic'}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => updateDeviceStatus(device.id, !device.isActive)}>
                    <Settings className="w-4 h-4 mr-2" />
                    {device.isActive ? 'Mark Offline' : 'Mark Online'}
                  </Button>
                  {device.id !== currentDevice?.id && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeDevice(device.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
