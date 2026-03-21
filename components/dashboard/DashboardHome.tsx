import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Laptop, Tablet, Globe, Activity, Send, Clipboard, Shield } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useClipboard } from '@/hooks/useClipboard';
import { useFileTransfer } from '@/hooks/useFileTransfer';

const DashboardHome = () => {
  const { devices, currentDevice } = useDevices();
  const { clipboardHistory } = useClipboard();
  const { transfers } = useFileTransfer();

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      case 'desktop': return <Laptop className="w-5 h-5" />;
      case 'browser': return <Globe className="w-5 h-5" />;
      default: return <Laptop className="w-5 h-5" />;
    }
  };

  const activeDevices = devices.filter(device => device.isActive);
  const recentTransfers = transfers.slice(0, 3);
  const recentClipboard = clipboardHistory.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to UniLink - your unified device ecosystem</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Devices</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDevices.length}</div>
            <p className="text-xs text-muted-foreground">
              {devices.length > activeDevices.length ? `${devices.length - activeDevices.length} offline` : 'All online'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Transfers</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.length}</div>
            <p className="text-xs text-muted-foreground">
              {transfers.filter(t => t.transfer_status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clipboard Items</CardTitle>
            <Clipboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clipboardHistory.length}</div>
            <p className="text-xs text-muted-foreground">Synced across devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Secure</div>
            <p className="text-xs text-muted-foreground">End-to-end encrypted</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Send File to Device
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Clipboard className="w-4 h-4 mr-2" />
              Sync Clipboard
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Smartphone className="w-4 h-4 mr-2" />
              Add New Device
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected Devices</CardTitle>
            <CardDescription>Your active device connections</CardDescription>
          </CardHeader>
          <CardContent>
            {activeDevices.length > 0 ? (
              <div className="space-y-3">
                {activeDevices.slice(0, 3).map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getDeviceIcon(device.deviceType)}
                      <div>
                        <p className="font-medium">{device.deviceName}</p>
                        <p className="text-sm text-gray-500">{device.platform}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {device.id === currentDevice?.id && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Current</span>
                      )}
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                ))}
                {activeDevices.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{activeDevices.length - 3} more devices
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No active devices</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent File Transfers</CardTitle>
            <CardDescription>Latest file sharing activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransfers.length > 0 ? (
              <div className="space-y-3">
                {recentTransfers.map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <p className="font-medium">{transfer.fileName}</p>
                      <p className="text-sm text-gray-500">
                        {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      transfer.transferStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      transfer.transferStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {transfer.transferStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent transfers</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Clipboard</CardTitle>
            <CardDescription>Latest clipboard synchronization</CardDescription>
          </CardHeader>
          <CardContent>
            {recentClipboard.length > 0 ? (
              <div className="space-y-3">
                {recentClipboard.map((item) => (
                  <div key={item.id} className="p-2 border rounded-lg">
                    <p className="text-sm font-medium truncate">{item.content}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.syncTimestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent clipboard items</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
