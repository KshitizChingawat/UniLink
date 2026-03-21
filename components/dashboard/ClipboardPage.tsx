
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clipboard, Copy, Share, Trash2, Clock } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

const ClipboardPage = () => {
  const { clipboardHistory, loading, syncClipboard, copyToClipboard } = useClipboard();
  const [newContent, setNewContent] = useState('');

  const handleSync = async () => {
    if (newContent.trim()) {
      await syncClipboard(newContent);
      setNewContent('');
    }
  };

  const handleCopy = async (content: string) => {
    await copyToClipboard(content);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clipboard Sync</h1>
        <p className="text-gray-600 mt-2">Synchronize clipboard content across all your devices</p>
      </div>

      {/* Sync New Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clipboard className="w-5 h-5" />
            <span>Sync New Content</span>
          </CardTitle>
          <CardDescription>
            Add new content to sync across all your connected devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste or type content to sync..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex space-x-2">
            <Button 
              onClick={handleSync} 
              disabled={!newContent.trim() || loading}
            >
              <Share className="w-4 h-4 mr-2" />
              Sync to Devices
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setNewContent('')}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clipboard History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Clipboard History</span>
          </CardTitle>
          <CardDescription>
            Recent items synced across your devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : clipboardHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clipboard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No clipboard history</h3>
              <p className="text-gray-600">
                Start syncing content to see it appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {clipboardHistory.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {item.contentType}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(item.syncTimestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(item.content)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 rounded p-3 max-h-32 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap break-words">
                      {item.content}
                    </pre>
                  </div>
                  
                  {item.syncedToDevices && item.syncedToDevices.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        Synced to {item.syncedToDevices.length} device(s)
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClipboardPage;
