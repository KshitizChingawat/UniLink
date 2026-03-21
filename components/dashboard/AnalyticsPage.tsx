
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Activity, Users, Clock, Zap } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useClipboard } from '@/hooks/useClipboard';
import { useFileTransfer } from '@/hooks/useFileTransfer';

const AnalyticsPage = () => {
  const { devices } = useDevices();
  const { clipboardHistory } = useClipboard();
  const { transfers } = useFileTransfer();

  const totalDevices = devices.length;
  const activeDevices = devices.filter(d => d.isActive).length;
  const totalClipboardItems = clipboardHistory.length;
  const totalTransfers = transfers.length;
  const completedTransfers = transfers.filter(t => t.transferStatus === 'completed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Monitor your UniLink usage and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {activeDevices} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Transfers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransfers}</div>
            <p className="text-xs text-muted-foreground">
              {completedTransfers} completed successfully
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clipboard Syncs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClipboardItems}</div>
            <p className="text-xs text-muted-foreground">
              Items synchronized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTransfers > 0 ? Math.round((completedTransfers / totalTransfers) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Transfer success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transfers.slice(0, 5).map((transfer) => (
                    <div key={transfer.id} className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{transfer.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transfer.createdAt).toLocaleString()}
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
                  {transfers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No activity yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Status</CardTitle>
                <CardDescription>Current device connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {devices.slice(0, 5).map((device) => (
                    <div key={device.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          device.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                        <div>
                          <p className="text-sm font-medium">{device.deviceName}</p>
                          <p className="text-xs text-muted-foreground">{device.platform}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        device.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {device.isActive ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  ))}
                  {devices.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No devices registered
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Analytics</CardTitle>
              <CardDescription>Detailed device usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices.map((device) => (
                  <div key={device.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{device.deviceName}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        device.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {device.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Platform</p>
                        <p className="font-medium">{device.platform}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{device.deviceType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Seen</p>
                        <p className="font-medium">{new Date(device.lastSeen || device.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registered</p>
                        <p className="font-medium">{new Date(device.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {devices.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No devices to analyze
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer History</CardTitle>
              <CardDescription>Complete file transfer analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transfers.map((transfer) => (
                  <div key={transfer.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{transfer.fileName}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        transfer.transferStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        transfer.transferStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transfer.transferStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-medium">{(transfer.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium">{transfer.fileType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p className="font-medium">{new Date(transfer.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium">
                          {transfer.completedAt ? new Date(transfer.completedAt).toLocaleString() : 'Not completed'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {transfers.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No transfers to analyze
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
