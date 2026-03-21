import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Send, Trash2, X, FileText, Image, Video, Archive } from 'lucide-react';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { useDevices } from '@/hooks/useDevices';
import { useDropzone } from 'react-dropzone';

const FileTransferPage = () => {
  const { transfers, loading, startFileTransfer, cancelTransfer } = useFileTransfer();
  const { devices } = useDevices();
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const targetDevice = selectedDevice === 'all' ? undefined : selectedDevice;
      await startFileTransfer(file, targetDevice);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 100 * 1024 * 1024 // 100MB
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const targetDevice = selectedDevice === 'all' ? undefined : selectedDevice;
      await startFileTransfer(file, targetDevice);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">File Transfer</h1>
        <p className="text-gray-600 mt-2">Send files securely across your connected devices</p>
      </div>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Send Files</CardTitle>
          <CardDescription>Select files to transfer to your connected devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    {device.device_name} ({device.device_type})
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
              Support for all file types up to 100MB
            </p>
            <Button onClick={handleFileSelect} disabled={loading}>
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
                      {getTransferField(transfer, 'transferStatus') === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelTransfer(transfer.id)}
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
                        {getTransferField(transfer, 'transferMethod') || 'cloud'} transfer
                      </span>
                      <span>
                        {new Date(getTransferField(transfer, 'createdAt') || '').toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
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
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Image className="w-8 h-8" />
              <span>Send Photos</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <FileText className="w-8 h-8" />
              <span>Send Documents</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Archive className="w-8 h-8" />
              <span>Send Archive</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileTransferPage;