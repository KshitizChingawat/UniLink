
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, User, Bell, Palette, Globe, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { useClipboard } from '@/hooks/useClipboard';
import { apiFetch } from '@/lib/api';

const getStoredSettings = () => {
  if (typeof window === 'undefined') {
    return {
      notificationsEnabled: true,
      autoSyncEnabled: true,
      darkModeEnabled: false,
      language: 'en',
      syncFrequency: 'instant',
      themeColor: 'blue',
    };
  }

  const saved = localStorage.getItem('unilink_settings');
  const parsed = saved ? JSON.parse(saved) : {};

  return {
    notificationsEnabled: parsed.notificationsEnabled ?? true,
    autoSyncEnabled: parsed.autoSyncEnabled ?? true,
    darkModeEnabled: parsed.darkModeEnabled ?? false,
    language: parsed.language ?? 'en',
    syncFrequency: parsed.syncFrequency ?? 'instant',
    themeColor: parsed.themeColor ?? 'blue',
  };
};

const SettingsPage = () => {
  const { user, updateProfile } = useAuth();
  const { devices } = useDevices();
  const { transfers } = useFileTransfer();
  const { clipboardHistory } = useClipboard();
  const [preferences, setPreferences] = useState(getStoredSettings);
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const proActive = user?.plan === 'pro' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() > Date.now());

  useEffect(() => {
    const savedProfile = JSON.parse(localStorage.getItem('unilink_profile') || '{}');
    setProfile({
      firstName: savedProfile.firstName ?? user?.firstName ?? '',
      lastName: savedProfile.lastName ?? user?.lastName ?? '',
      email: savedProfile.email ?? user?.email ?? '',
    });
  }, [user?.id]);

  useEffect(() => {
    // Only apply dark mode when logged in (token present) — never affect login/register pages
    if (localStorage.getItem('auth_token')) {
      document.documentElement.classList.toggle('dark', preferences.darkModeEnabled);
    }
  }, [preferences.darkModeEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme-color', preferences.themeColor);
  }, [preferences.themeColor]);

  const exportAllData = () => {
    const lines = [
      `UniLink Export`,
      `Exported At: ${new Date().toLocaleString()}`,
      `User: ${profile.firstName} ${profile.lastName}`.trim(),
      `Email: ${profile.email}`,
      ``,
      `Devices`,
      ...devices.map((device) => `- ${device.deviceName} | ${device.deviceType} | ${device.platform} | Connected: ${device.isActive} | Last Seen: ${device.lastSeen || 'N/A'}`),
      ``,
      `File Transfers`,
      ...transfers.map((transfer) => `- ${transfer.fileName} | ${transfer.fileType || 'unknown'} | ${transfer.fileSize} bytes | Status: ${transfer.transferStatus} | Sent: ${transfer.createdAt} | Sender Device ID: ${transfer.senderDeviceId || 'N/A'} | Receiver Device ID: ${transfer.receiverDeviceId || 'N/A'}`),
      ``,
      `Clipboard History`,
      ...clipboardHistory.map((item) => `- ${item.contentType} | ${item.syncTimestamp} | ${item.content.slice(0, 120)}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unilink-export-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Your UniLink data export has been downloaded.');
  };

  const clearAllData = async () => {
    try {
      await Promise.all(transfers.map((transfer) => apiFetch(`/api/file-transfers/${transfer.id}`, { method: 'DELETE' })));
      localStorage.removeItem('unilink_settings');
      localStorage.removeItem('unilink_profile');
      toast.success('Dashboard, analytics, and file transfer data cleared.');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to clear all data.');
    }
  };

  const handleSaveProfile = async () => {
    try {
      localStorage.setItem('unilink_profile', JSON.stringify(profile));
      await updateProfile(profile);
      toast.success('Profile settings saved successfully');
    } catch (error) {
      toast.error('Failed to save profile changes.');
    }
  };

  const handleProfileChange = (field: 'firstName' | 'lastName' | 'email', value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSavePreferences = () => {
    localStorage.setItem('unilink_settings', JSON.stringify(preferences));
    toast.success('Preferences updated successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account and application preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>
                Update your personal information
                {proActive ? ` • Pro active until ${new Date(user!.subscriptionExpiresAt!).toLocaleDateString()}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {proActive ? (
                <Badge className="border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-400/15 dark:text-amber-300">
                  Gold Pro Badge
                </Badge>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="utc">
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">Eastern Standard Time</SelectItem>
                    <SelectItem value="pst">Pacific Standard Time</SelectItem>
                    <SelectItem value="cet">Central European Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveProfile}>Save Profile</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>General Preferences</span>
                </CardTitle>
                <CardDescription>Customize your app experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Auto-sync enabled</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync clipboard and files
                    </p>
                  </div>
                  <Switch
                    checked={preferences.autoSyncEnabled}
                    onCheckedChange={(checked) => setPreferences((current) => ({ ...current, autoSyncEnabled: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select value={preferences.syncFrequency} onValueChange={(value) => setPreferences((current) => ({ ...current, syncFrequency: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="30s">Every 30 seconds</SelectItem>
                      <SelectItem value="1m">Every minute</SelectItem>
                      <SelectItem value="5m">Every 5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={preferences.language} onValueChange={(value) => setPreferences((current) => ({ ...current, language: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="w-5 h-5" />
                  <span>Appearance</span>
                </CardTitle>
                <CardDescription>Customize the app appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Dark Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      Use dark theme for the interface
                    </p>
                  </div>
                  <Switch
                    checked={preferences.darkModeEnabled}
                    onCheckedChange={(checked) => setPreferences((current) => ({ ...current, darkModeEnabled: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Theme Color</Label>
                  <Select value={preferences.themeColor} onValueChange={(value) => setPreferences((current) => ({ ...current, themeColor: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePreferences}>Save Preferences</Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notification Settings</span>
              </CardTitle>
              <CardDescription>Choose what notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Push Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={preferences.notificationsEnabled}
                  onCheckedChange={(checked) => setPreferences((current) => ({ ...current, notificationsEnabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">File Transfer Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when files are sent or received
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Device Connections</h4>
                  <p className="text-sm text-muted-foreground">
                    Alert when new devices connect
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Security Alerts</h4>
                  <p className="text-sm text-muted-foreground">
                    Important security notifications
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Clipboard Sync</h4>
                  <p className="text-sm text-muted-foreground">
                    Notify when clipboard content is synced
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Privacy Settings</span>
              </CardTitle>
              <CardDescription>Control your data and privacy preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Analytics Collection</h4>
                  <p className="text-sm text-muted-foreground">
                    Help improve the app by sharing usage data
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Crash Reports</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically send crash reports to help fix issues
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Data Retention</h4>
                  <p className="text-sm text-muted-foreground">
                    Keep clipboard history for 30 days
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Data Management</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={exportAllData}>
                    Export My Data
                  </Button>
                  <Button variant="outline" className="w-full" onClick={clearAllData}>
                    Clear All Data
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => toast.error('Account deletion is intentionally protected in this demo build.')}>
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
