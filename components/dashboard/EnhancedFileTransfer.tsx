
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, File, Trash2, Share2 } from 'lucide-react';
import { useEnhancedFileTransfer } from '@/hooks/useEnhancedFileTransfer';
import { useDevices } from '@/hooks/useDevices';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

const EnhancedFileTransfer = () => {
  const { uploadFile, downloadFile, uploadProgress, downloadProgress, transfers } = useEnhancedFileTransfer();
  const { devices } = useDevices();
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setIsUploading(true);
      await uploadFile(file, undefined, (progress) => {
        console.log(`Upload progress: ${progress}%`);
      });
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 100 * 1024 * 1024 // 100MB
  });

  const handleDownload = async (transferId: string, fileName: string) => {
    await downloadFile(transferId, fileName);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>File Transfer</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">Drop files here to upload...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-gray-400">Max file size: 100MB</p>
              </div>
            )}
          </div>

          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">Uploading...</h4>
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Upload Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <File className="h-5 w-5" />
            <span>Recent Transfers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transfers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No file transfers yet</p>
            ) : (
              transfers.slice(0, 10).map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <File className="h-8 w-8 text-gray-400" />
                    <div>
                      <p className="font-medium">{transfer.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(transfer.file_size)} • {new Date(transfer.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      transfer.transfer_status === 'completed' ? 'default' :
                      transfer.transfer_status === 'in_progress' ? 'secondary' :
                      transfer.transfer_status === 'failed' ? 'destructive' : 'outline'
                    }>
                      {transfer.transfer_status}
                    </Badge>
                    
                    {transfer.transfer_status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(transfer.id, transfer.file_name)}
                        disabled={!!downloadProgress[transfer.id]}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedFileTransfer;
