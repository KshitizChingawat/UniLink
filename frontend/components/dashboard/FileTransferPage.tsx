import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Send, X, FileText, Image, Video, Archive, Play, Crown, Trash2 } from 'lucide-react';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { useDevices } from '@/hooks/useDevices';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { BASE_URL } from '@/lib/api';

const FileTransferPage = () => {
  const { user } = useAuth();
  const { transfers, loading, uploadProgress, startFileTransfer, cancelActiveUpload, deleteTransfer, downloadFile } = useFileTransfer();
  const { devices } = useDevices();
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewTransferId, setPreviewTransferId] = useState('');
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proActive = user?.plan === 'pro' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() > Date.now());
  const uploadLimit = proActive ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024;
  const uploadLimitLabel = proActive ? '10 GB' : '100 MB';
  const upgradeLimitMessage = proActive
    ? `Your Pro plan supports files up to ${uploadLimitLabel}.`
    : "This file can't be uploaded under the Free plan. Upgrade to Pro to share files up to 10 GB.";

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.size > uploadLimit) {
        toast.error(upgradeLimitMessage);
        continue;
      }
      const targetDevice = selectedDevice === 'all' ? undefined : selectedDevice;
      await startFileTransfer(file, targetDevice);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: uploadLimit,
    noClick: true,
    noKeyboard: true,
  });

  const handleFileSelect = (accept?: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept || '';
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    for (const file of files) {
      if (file.size > uploadLimit) {
        toast.error(upgradeLimitMessage);
        continue;
      }
      const targetDevice = selectedDevice === 'all' ? undefined : selectedDevice;
      await startFileTransfer(file, targetDevice);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = '';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <Archive className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  // Helper function to normalize transfer field access
  const getTransferField = (transfer: any, field: string): any => {
    // Handle both camelCase and snake_case field names
    const fieldMappings: Record<string, string[]> = {
      fileName: ['fileName', 'file_name'],
      fileSize: ['fileSize', 'file_size'],
      fileType: ['fileType', 'file_type'],
      transferStatus: ['transferStatus', 'transfer_status'],
      transferMethod: ['transferMethod', 'transfer_method'],
      createdAt: ['createdAt', 'created_at'],
      senderDeviceId: ['senderDeviceId', 'sender_device_id'],
      receiverDeviceId: ['receiverDeviceId', 'receiver_device_id']
    };
    
    const possibleFields = fieldMappings[field] || [field];
    for (const f of possibleFields) {
      if (transfer[f] !== undefined) {
        return transfer[f];
      }
    }
    return '';
  };

  const getTransferProgress = (transfer: any) => {
    if (getTransferField(transfer, 'transferStatus') === 'in_progress' && uploadProgress[transfer.id] !== undefined) {
      return uploadProgress[transfer.id];
    }
    const status = getTransferField(transfer, 'transferStatus');
    switch (status) {
      case 'completed': return 100;
      case 'in_progress': return 75;
      case 'pending': return 25;
      default: return 0;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isVideoTransfer = (transfer: any) => String(getTransferField(transfer, 'fileType') || '').startsWith('video/');

  const previewVideo = async (transfer: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BASE_URL}/api/file-transfers/${transfer.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        toast.error('Failed to load video preview.');
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setPreviewName(getTransferField(transfer, 'fileName') || 'Video preview');
      setPreviewTransferId(transfer.id);
      setMiniPlayerOpen(false);
    } catch (error) {
      toast.error('Failed to load video preview.');
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setPreviewName('');
    setPreviewTransferId('');
    setMiniPlayerOpen(false);
  };

  const openMiniPlayer = () => {
    setMiniPlayerOpen(true);
  };

  const closeMiniPlayer = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setPreviewName('');
    setPreviewTransferId('');
    setMiniPlayerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">File Transfer</h1>
        <p className="text-gray-600 mt-2">Send files securely across your connected devices</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge className={proActive ? 'border border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/50 dark:bg-amber-400/15 dark:text-amber-300' : ''} variant={proActive ? 'default' : 'secondary'}>
            {proActive ? (
              <>
                <Crown className="mr-1 h-3.5 w-3.5" />
                Pro
              </>
            ) : (
              'Free'
            )}
          </Badge>
          <span className="text-sm text-gray-600">
            Share files up to {uploadLimitLabel}
            {proActive && user?.subscriptionExpiresAt ? ` until ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}` : ''}
          </span>
        </div>
      </div>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Send Files</CardTitle>
          <CardDescription>Select files to transfer to your connected devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(uploadProgress).length > 0 ? (
            <div className="space-y-3 rounded-xl border border-unilink-200 bg-unilink-50/70 p-4">
              {Object.entries(uploadProgress).map(([uploadId, percent]) => {
                const activeTransfer = transfers.find((transfer) => transfer.id === uploadId);
                const activeName = activeTransfer ? getTransferField(activeTransfer, 'fileName') : uploadId;
                return (
                  <div key={uploadId} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-gray-900">{activeName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{percent}%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => cancelActiveUpload(uploadId)}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Device Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Device (Optional)</label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Send to all devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All connected devices</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.deviceName} ({device.deviceType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drag & Drop Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive 
                ? 'border-unilink-500 bg-unilink-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium text-unilink-600 mb-2">
                Drop files here to upload...
              </p>
            ) : (
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop files here or click to browse
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Support for all file types up to {uploadLimitLabel}
            </p>
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleFileSelect();
              }}
              disabled={loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>Recent file transfers and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No file transfers yet</p>
              <p className="text-sm">Upload some files to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transfers.map((transfer) => (
                <div key={transfer.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(getTransferField(transfer, 'fileType'))}
                      <div>
                        <p className="font-medium">{getTransferField(transfer, 'fileName')}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(getTransferField(transfer, 'fileSize') || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(getTransferField(transfer, 'transferStatus') || 'pending')}>
                        {(getTransferField(transfer, 'transferStatus') || 'pending').replace('_', ' ')}
                      </Badge>
                      {getTransferField(transfer, 'transferStatus') === 'completed' && isVideoTransfer(transfer) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => previewVideo(transfer)}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {getTransferField(transfer, 'transferStatus') === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(transfer.id, getTransferField(transfer, 'fileName') || 'download')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {getTransferField(transfer, 'transferStatus') === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelActiveUpload(transfer.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Progress value={getTransferProgress(transfer)} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>
                        {isVideoTransfer(transfer) ? 'video transfer' : `${getTransferField(transfer, 'transferMethod') || 'cloud'} transfer`}
                      </span>
                      <span>
                        {new Date(getTransferField(transfer, 'createdAt') || '').toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {getTransferField(transfer, 'transferStatus') !== 'in_progress' && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => deleteTransfer(transfer.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common file transfer operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" type="button" className="h-auto p-4 flex flex-col items-center space-y-2" onClick={() => { handleFileSelect('image/*'); toast.info('Choose photos to send.'); }}>
              <Image className="w-8 h-8" />
              <span>Send Photos</span>
            </Button>
            <Button variant="outline" type="button" className="h-auto p-4 flex flex-col items-center space-y-2" onClick={() => { handleFileSelect('video/*'); toast.info('Choose a video to send.'); }}>
              <Video className="w-8 h-8" />
              <span>Send Videos</span>
            </Button>
            <Button variant="outline" type="button" className="h-auto p-4 flex flex-col items-center space-y-2" onClick={() => { handleFileSelect('.pdf,.doc,.docx,.txt'); toast.info('Choose documents to send.'); }}>
              <FileText className="w-8 h-8" />
              <span>Send Documents</span>
            </Button>
            <Button variant="outline" type="button" className="h-auto p-4 flex flex-col items-center space-y-2 md:col-span-3" onClick={() => { handleFileSelect('.zip,.rar,.7z,.tar'); toast.info('Choose an archive to send.'); }}>
              <Archive className="w-8 h-8" />
              <span>Send Archive</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewUrl) && !miniPlayerOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewName || 'Video preview'}</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl bg-black">
                <video controls className="max-h-[68vh] w-full object-contain" src={previewUrl} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={openMiniPlayer}>
                  Miniplayer
                </Button>
                <Button type="button" variant="outline" onClick={() => previewTransferId && downloadFile(previewTransferId, previewName || 'video')} disabled={!previewTransferId}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {miniPlayerOpen && previewUrl ? (
        <div className="fixed bottom-6 right-6 z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{previewName || 'Video preview'}</p>
              <p className="text-xs text-slate-400">Mini player</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-slate-800 hover:text-white" onClick={() => setMiniPlayerOpen(false)}>
                Open
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-slate-800 hover:text-white" onClick={closeMiniPlayer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <video controls className="aspect-video w-full bg-black object-contain" src={previewUrl} />
        </div>
      ) : null}
    </div>
  );
};

export default FileTransferPage;
