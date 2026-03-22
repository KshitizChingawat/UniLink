import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Users, Smartphone, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';
import { useDevices } from '@/hooks/useDevices';

const RealTimeSyncStatus = () => {
  const { 
    isOnline, 
    isConnected, 
    syncStatus, 
    lastSyncTime, 
    syncQueue, 
    connectionAttempts,
    triggerManualSync,
    getSyncStats 
  } = useRealTimeSync();
  const { devices } = useDevices();

  const activeDevices = devices.filter(d => d.isActive);
  const stats = getSyncStats();

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4 text-red-500" />;
    if (!isConnected) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    if (syncStatus === 'syncing') return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!isConnected) return connectionAttempts > 0 ? `Reconnecting (${connectionAttempts})` : 'Connecting';
    if (syncStatus === 'syncing') return 'Syncing';
    if (syncStatus === 'connected') return 'Connected';
    return 'Idle';
  };

  const getStatusColor = () => {
    if (!isOnline || !isConnected) return 'destructive';
    if (syncStatus === 'syncing') return 'secondary';
    if (syncStatus === 'connected') return 'default';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Real-time Sync</CardTitle>
        {getStatusIcon()}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Network</span>
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Devices</span>
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span className="text-sm font-medium">{activeDevices.length}</span>
            </div>
          </div>

          {syncQueue > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Queued</span>
              <Badge variant="secondary">{syncQueue}</Badge>
            </div>
          )}

          {lastSyncTime && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Sync</span>
              <span className="text-xs text-muted-foreground">
                {lastSyncTime.toLocaleTimeString()}
              </span>
            </div>
          )}

          {activeDevices.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Connected:</span>
              {activeDevices.slice(0, 3).map((device) => (
                <div key={device.id} className="flex items-center space-x-2 text-xs">
                  <Smartphone className="h-3 w-3" />
                  <span className="truncate">{device.deviceName}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              ))}
              {activeDevices.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{activeDevices.length - 3} more
                </div>
              )}
            </div>
          )}

          {(!isConnected || syncQueue > 0) && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={triggerManualSync}
              className="w-full"
              disabled={syncStatus === 'syncing'}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'syncing' ? 'Syncing...' : 'Manual Sync'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeSyncStatus;