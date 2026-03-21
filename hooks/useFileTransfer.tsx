import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useDevices } from './useDevices';
import { toast } from 'sonner';

export interface FileTransfer {
  id: string;
  user_id: string;
  sender_device_id: string;
  receiver_device_id?: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  file_hash?: string;
  transfer_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  transfer_method: 'cloud' | 'p2p' | 'local';
  encrypted_metadata?: any;
  created_at: string;
  completed_at?: string;
}

export const useFileTransfer = () => {
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { user } = useAuth();
  const { currentDevice, devices } = useDevices();

  // Fetch file transfers
  const fetchTransfers = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/file-transfers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch transfers error:', data.error);
        return;
      }

      setTransfers(data || []);
    } catch (err) {
      console.error('Fetch transfers error:', err);
    }
  };

  // Start file transfer
  const startFileTransfer = async (
    file: File,
    targetDeviceId?: string,
    transferMethod: 'cloud' | 'p2p' | 'local' = 'cloud'
  ) => {
    if (!user || !currentDevice) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      
      // Send as JSON to match backend expectations
      const transferData = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        senderDeviceId: currentDevice.id,
        receiverDeviceId: targetDeviceId,
        transferMethod: transferMethod
      };

      const response = await fetch('/api/file-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transferData)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Start transfer error:', data.error);
        toast.error('Failed to start file transfer');
        return;
      }

      await fetchTransfers();
      toast.success(`File transfer started: ${file.name}`);
      return data;
    } catch (err) {
      console.error('Start transfer error:', err);
      toast.error('Failed to start file transfer');
    } finally {
      setLoading(false);
    }
  };

  // Cancel file transfer
  const cancelTransfer = async (transferId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/file-transfers/${transferId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transfer_status: 'cancelled'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Cancel transfer error:', data.error);
        toast.error('Failed to cancel transfer');
        return;
      }

      await fetchTransfers();
      toast.success('Transfer cancelled');
    } catch (err) {
      console.error('Cancel transfer error:', err);
      toast.error('Failed to cancel transfer');
    }
  };

  // Download file
  const downloadFile = async (transferId: string, fileName: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/file-transfers/${transferId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        toast.error('Failed to download file');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('File downloaded successfully');
    } catch (err) {
      console.error('Download file error:', err);
      toast.error('Failed to download file');
    }
  };

  // Get transfer status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'failed':
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (user) {
      fetchTransfers();
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchTransfers, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return {
    transfers,
    loading,
    uploadProgress,
    startFileTransfer,
    cancelTransfer,
    downloadFile,
    getStatusColor,
    formatFileSize,
    fetchTransfers
  };
};