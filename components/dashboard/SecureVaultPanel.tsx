
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Shield, Plus, Trash2, Eye, Copy, FileText, Clipboard } from 'lucide-react';
import { useSecureVault } from '@/hooks/useSecureVault';
import { toast } from 'sonner';

const SecureVaultPanel = () => {
  const { vaultItems, loading, storeSecurely, retrieveSecurely, deleteVaultItem } = useSecureVault();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [content, setContent] = useState('');
  const [itemType, setItemType] = useState<'clipboard' | 'file' | 'note'>('note');
  const [tags, setTags] = useState('');
  const [viewingItem, setViewingItem] = useState<any>(null);

  const handleStore = async () => {
    if (!content.trim()) return;

    const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
    await storeSecurely(content, itemType, { title: content.slice(0, 50) }, tagArray);
    
    setContent('');
    setTags('');
    setIsDialogOpen(false);
  };

  const handleView = async (itemId: string) => {
    const item = await retrieveSecurely(itemId);
    if (item) {
      setViewingItem(item);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'clipboard': return <Clipboard className="h-4 w-4" />;
      case 'file': return <FileText className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Secure Vault</span>
          </CardTitle>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Store Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Store Item Securely</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="itemType">Type</Label>
                  <select
                    id="itemType"
                    className="w-full mt-1 p-2 border rounded"
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                  >
                    <option value="note">Note</option>
                    <option value="clipboard">Clipboard</option>
                    <option value="file">File</option>
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Enter content to store securely..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="work, personal, important..."
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleStore} disabled={loading}>
                    Store Securely
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {vaultItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No secure items stored yet</p>
            ) : (
              vaultItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(item.item_type)}
                      <div>
                        <p className="font-medium">
                          {item.metadata?.title || `${item.item_type} item`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleView(item.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteVaultItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Item Dialog */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Secure Item</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge>{viewingItem.item_type}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(viewingItem.decrypted_content)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">
                  {viewingItem.decrypted_content}
                </pre>
              </div>
              
              {viewingItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingItem.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecureVaultPanel;
