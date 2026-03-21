
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Bluetooth, 
  Search, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Signal,
  Link,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useBluetoothDiscovery } from '@/hooks/useBluetoothDiscovery';

const BluetoothPanel = () => {
  const {
    discoveredDevices,
    pairedDevices,
    scanning,
    bluetoothSupported,
    startScanning,
    pairDevice,
    removeDevice,
    fetchDevices
  } = useBluetoothDiscovery();

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes('phone') || name.includes('mobile')) return <Smartphone className="w-4 h-4" />;
    if (name.includes('laptop') || name.includes('macbook')) return <Laptop className="w-4 h-4" />;
    if (name.includes('tablet') || name.includes('ipad')) return <Tablet className="w-4 h-4" />;
    return <Bluetooth className="w-4 h-4" />;
  };

  const getSignalStrength = (strength?: number) => {
    if (!strength) return 'Unknown';
    if (strength >= -50) return 'Excellent';
    if (strength >= -70) return 'Good';
    if (strength >= -80) return 'Fair';
    return 'Poor';
  };

  const getSignalColor = (strength?: number) => {
    if (!strength) return 'text-gray-500';
    if (strength >= -50) return 'text-green-600';
    if (strength >= -70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!bluetoothSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gray-500">
            <Bluetooth className="w-5 h-5" />
            <span>Bluetooth Discovery</span>
          </CardTitle>
          <CardDescription>
            Bluetooth Web API is not supported in this browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Bluetooth className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bluetooth Not Available</h3>
            <p className="text-gray-600 text-sm">
              Please use Chrome, Edge, or another Chromium-based browser for Bluetooth functionality
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bluetooth Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bluetooth className="w-5 h-5 text-blue-600" />
            <span>Bluetooth Discovery</span>
          </CardTitle>
          <CardDescription>
            Discover and connect to nearby Bluetooth devices for seamless data sharing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Button
              onClick={startScanning}
              disabled={scanning}
              className="flex items-center space-x-2"
            >
              {scanning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{scanning ? 'Scanning...' : 'Scan for Devices'}</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={fetchDevices}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">Discovered</p>
              <p className="text-gray-600">{discoveredDevices.length} devices</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Paired</p>
              <p className="text-gray-600">{pairedDevices.length} devices</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discovered Devices */}
      {discoveredDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-blue-600" />
              <span>Discovered Devices</span>
            </CardTitle>
            <CardDescription>
              Nearby Bluetooth devices available for pairing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {discoveredDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getDeviceIcon(device.device_name)}
                    <div>
                      <p className="text-sm font-medium">{device.device_name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Signal className="w-3 h-3" />
                        <span className={getSignalColor(device.signal_strength)}>
                          {getSignalStrength(device.signal_strength)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {device.pairing_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => pairDevice(device.bluetooth_mac)}
                    className="flex items-center space-x-1"
                  >
                    <Link className="w-3 h-3" />
                    <span>Pair</span>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paired Devices */}
      {pairedDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link className="w-5 h-5 text-green-600" />
              <span>Paired Devices</span>
            </CardTitle>
            <CardDescription>
              Successfully paired Bluetooth devices ready for data transfer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pairedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200"
                >
                  <div className="flex items-center space-x-3">
                    {getDeviceIcon(device.device_name)}
                    <div>
                      <p className="text-sm font-medium">{device.device_name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          Paired
                        </Badge>
                        <span>
                          Last seen: {new Date(device.last_discovered).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Bluetooth Device</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{device.device_name}" from your paired devices?
                          You'll need to pair it again to use it for file transfers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeDevice(device.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty States */}
      {discoveredDevices.length === 0 && pairedDevices.length === 0 && !scanning && (
        <Card>
          <CardContent className="text-center py-12">
            <Bluetooth className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bluetooth Devices</h3>
            <p className="text-gray-600 text-sm mb-4">
              Start scanning to discover nearby Bluetooth devices for pairing and data transfer
            </p>
            <Button onClick={startScanning} className="flex items-center space-x-2">
              <Search className="w-4 h-4" />
              <span>Start Scanning</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BluetoothPanel;
