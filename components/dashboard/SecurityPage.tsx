
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Wifi, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDevices } from '@/hooks/useDevices';

const SecurityPage = () => {
  const { user } = useAuth();
  const { devices } = useDevices();
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [secureTransferEnabled, setSecureTransferEnabled] = useState(true);

  const securityScore = () => {
    let score = 0;
    if (encryptionEnabled) score += 25;
    if (twoFactorEnabled) score += 25;
    if (autoLockEnabled) score += 25;
    if (secureTransferEnabled) score += 25;
    return score;
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Needs Improvement';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Security Center</h1>
        <p className="text-gray-600 mt-2">Manage your account security and device protection</p>
      </div>

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Security Score</span>
          </CardTitle>
          <CardDescription>Your overall security rating</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-4xl font-bold ${getScoreColor(securityScore())}`}>
                {securityScore()}%
              </div>
              <p className="text-sm text-muted-foreground">
                {getScoreStatus(securityScore())}
              </p>
            </div>
            <div className="text-right">
              <Badge variant={securityScore() >= 75 ? 'default' : securityScore() >= 50 ? 'secondary' : 'destructive'}>
                {getScoreStatus(securityScore())}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Based on current settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Security Settings</TabsTrigger>
          <TabsTrigger value="devices">Device Security</TabsTrigger>
          <TabsTrigger value="activity">Security Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="w-5 h-5" />
                  <span>Encryption & Privacy</span>
                </CardTitle>
                <CardDescription>Control how your data is protected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">End-to-End Encryption</h4>
                    <p className="text-sm text-muted-foreground">
                      Encrypt all data transfers between devices
                    </p>
                  </div>
                  <Switch
                    checked={encryptionEnabled}
                    onCheckedChange={setEncryptionEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Secure File Transfer</h4>
                    <p className="text-sm text-muted-foreground">
                      Use encrypted channels for file sharing
                    </p>
                  </div>
                  <Switch
                    checked={secureTransferEnabled}
                    onCheckedChange={setSecureTransferEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Auto-Lock Sessions</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically lock inactive sessions
                    </p>
                  </div>
                  <Switch
                    checked={autoLockEnabled}
                    onCheckedChange={setAutoLockEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>Authentication</span>
                </CardTitle>
                <CardDescription>Secure your account access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security
                    </p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Account Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{user?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Created:</span>
                      <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full" variant="outline">
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5" />
                <span>Connected Devices</span>
              </CardTitle>
              <CardDescription>Manage security for your connected devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices.map((device) => (
                  <div key={device.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          device.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                        <div>
                          <h4 className="font-medium">{device.deviceName}</h4>
                          <p className="text-sm text-muted-foreground">{device.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {encryptionEnabled && (
                          <Badge variant="outline">
                            <Lock className="w-3 h-3 mr-1" />
                            Encrypted
                          </Badge>
                        )}
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Last Seen</p>
                        <p className="font-medium">{new Date(device.lastSeen || device.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium">{device.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{device.deviceType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Trust Level</p>
                        <p className="font-medium text-green-600">Trusted</p>
                      </div>
                    </div>
                  </div>
                ))}
                {devices.length === 0 && (
                  <div className="text-center py-8">
                    <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No devices connected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Security Activity</span>
              </CardTitle>
              <CardDescription>Recent security events and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Account Login</h4>
                    <p className="text-sm text-muted-foreground">
                      Successful login from your current device
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Wifi className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Device Connected</h4>
                    <p className="text-sm text-muted-foreground">
                      New device connection established
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      2 hours ago
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Lock className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Security Settings Updated</h4>
                    <p className="text-sm text-muted-foreground">
                      Encryption settings were modified
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 day ago
                    </p>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <Button variant="outline">View All Activity</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityPage;
