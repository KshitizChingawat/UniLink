
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Zap, Shield, Wifi } from 'lucide-react';
import RealTimeSyncStatus from './RealTimeSyncStatus';
import EnhancedFileTransfer from './EnhancedFileTransfer';
import SecureVaultPanel from './SecureVaultPanel';
import { useSmartSync } from '@/hooks/useSmartSync';

const SmartSyncDashboard = () => {
  const {
    autoSyncEnabled,
    setAutoSyncEnabled,
    smartSuggestionsEnabled,
    setSmartSuggestionsEnabled,
    processingQueue
  } = useSmartSync();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Smart Sync Hub</h1>
        <p className="text-gray-600 mt-2">Advanced device synchronization with AI-powered features</p>
      </div>

      {/* Quick Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <RealTimeSyncStatus />
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Sync</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {autoSyncEnabled ? 'ON' : 'OFF'}
            </div>
            <p className="text-xs text-muted-foreground">
              Automatic clipboard sync
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Suggestions</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {smartSuggestionsEnabled ? 'ON' : 'OFF'}
            </div>
            <p className="text-xs text-muted-foreground">
              Smart recommendations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingQueue}</div>
            <p className="text-xs text-muted-foreground">
              Items processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Feature Tabs */}
      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sync">Real-time Sync</TabsTrigger>
          <TabsTrigger value="files">File Transfer</TabsTrigger>
          <TabsTrigger value="vault">Secure Vault</TabsTrigger>
          <TabsTrigger value="settings">Smart Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wifi className="h-5 w-5" />
                <span>Real-time Synchronization</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">Auto Sync Settings</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoSync"
                        checked={autoSyncEnabled}
                        onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="autoSync" className="text-sm">
                        Enable automatic clipboard synchronization
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">AI Features</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="smartSuggestions"
                        checked={smartSuggestionsEnabled}
                        onChange={(e) => setSmartSuggestionsEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="smartSuggestions" className="text-sm">
                        Enable smart suggestions and analysis
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <EnhancedFileTransfer />
        </TabsContent>

        <TabsContent value="vault" className="space-y-4">
          <SecureVaultPanel />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Sync Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Synchronization</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-sync clipboard</p>
                        <p className="text-sm text-muted-foreground">Automatically sync clipboard content across devices</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoSyncEnabled}
                        onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                        className="rounded"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Smart suggestions</p>
                        <p className="text-sm text-muted-foreground">Get AI-powered suggestions for your workflow</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={smartSuggestionsEnabled}
                        onChange={(e) => setSmartSuggestionsEnabled(e.target.checked)}
                        className="rounded"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Background processing</p>
                        <p className="text-sm text-muted-foreground">Process sync operations in the background</p>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Real-time notifications</p>
                        <p className="text-sm text-muted-foreground">Get notified of sync events across devices</p>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmartSyncDashboard;
