
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clipboard, Copy, Share, Trash2, Clock } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

const ClipboardPage = () => {
  const {
    clipboardHistory,
    loading,
    clipboardWordLimit,
    clipboardMessageLimit,
    proActive,
    syncClipboard,
    copyToClipboard,
    deleteClipboardItem,
  } = useClipboard();
  const [newContent, setNewContent] = useState('');
  const currentWordCount = newContent.trim() ? newContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const overWordLimit = currentWordCount > clipboardWordLimit;
  const freeLimitReached = !proActive && clipboardMessageLimit !== null && clipboardHistory.length >= clipboardMessageLimit;

  const handleSync = async () => {
    if (newContent.trim() && !overWordLimit) {
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={proActive ? 'default' : 'secondary'}>
            {proActive ? 'Pro clipboard' : 'Free clipboard'}
          </Badge>
          <span className="text-gray-600">
            {proActive
              ? 'Up to 5000 words per message with unlimited saved messages.'
              : 'Up to 100 words per message and 10 saved messages.'}
          </span>
        </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={overWordLimit ? 'text-red-600' : 'text-gray-500'}>
              {currentWordCount}/{clipboardWordLimit} words
            </span>
            <span className={freeLimitReached ? 'text-red-600' : 'text-gray-500'}>
              {clipboardHistory.length}
              {clipboardMessageLimit ? `/${clipboardMessageLimit}` : ''} saved messages
            </span>
          </div>
          {overWordLimit && (
            <p className="text-sm text-red-600">
              {proActive
                ? 'Clipboard messages can contain up to 5000 words on Pro.'
                : 'Free plan clipboard messages can contain up to 100 words. Upgrade to Pro for 5000-word messages.'}
            </p>
          )}
          {freeLimitReached && (
            <p className="text-sm text-red-600">
              Free plan allows 10 clipboard messages. Delete an old message or upgrade to Pro.
            </p>
          )}
          <div className="flex space-x-2">
            <Button 
              onClick={handleSync} 
              disabled={!newContent.trim() || loading || overWordLimit || freeLimitReached}
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
          {clipboardHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clipboard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No clipboard history</h3>
              <p className="text-gray-600">
                {loading ? 'Loading clipboard history...' : 'Start syncing content to see it appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {loading && (
                <div className="rounded-lg border border-dashed border-unilink-200 bg-unilink-50/60 px-4 py-2 text-sm text-unilink-700">
                  Refreshing clipboard history...
                </div>
              )}
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

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => deleteClipboardItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
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
