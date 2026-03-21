
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Laptop, Tablet, Globe, Plus, Settings, Trash2 } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';

const DevicesPage = () => {
  const { devices, currentDevice, loading } = useDevices();

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
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No devices connected</h3>
            <p className="text-gray-600 mb-4">
              Start by connecting your first device to UniLink
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Connect Device
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
                      {getDeviceIcon(device.device_type)}
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
                    <div className={`w-3 h-3 rounded-full ${device.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
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
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  {device.id !== currentDevice?.id && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
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
