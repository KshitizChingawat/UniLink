import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch, ApiError, BASE_URL } from '@/lib/api';

let cachedTransfers: FileTransfer[] = [];
let cachedTransfersUserId: string | null = null;

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
  const [transfers, setTransfers] = useState<FileTransfer[]>(cachedTransfers);
  const [loading, setLoading] = useState(() => !cachedTransfers.length);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { user } = useAuth();

  const getCurrentDeviceId = (): string | null => {
    if (typeof window === 'undefined') return null;
    // First try the full registered device object
    const saved = localStorage.getItem('unilink_current_device');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) return parsed.id;
      } catch {
        localStorage.removeItem('unilink_current_device');
      }
    }
    return null;
  };

  // Auto-register this browser as a device if not already registered
  const ensureDeviceRegistered = async (): Promise<string | null> => {
    const existing = getCurrentDeviceId();
    if (existing) return existing;

    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    try {
      let deviceId = localStorage.getItem('unilink_device_id');
      if (!deviceId) {
        deviceId = `browser_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('unilink_device_id', deviceId);
      }
      const data = await apiFetch<{ id: string }>('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          deviceName: `${navigator.platform || 'Browser'} Browser`,
          deviceType: 'browser',
          platform: 'browser',
          deviceId,
        }),
      });
      localStorage.setItem('unilink_current_device', JSON.stringify(data));
      return data.id;
    } catch (err) {
      console.error('Auto device registration failed:', err);
      return null;
    }
  };

  // Fetch file transfers
  const fetchTransfers = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const data = await apiFetch<FileTransfer[]>('/api/file-transfers');
      cachedTransfers = data || [];
      setTransfers(cachedTransfers);
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
    if (!user) {
      toast.error('You must be logged in to transfer files.');
      return;
    }
    const currentDeviceId = await ensureDeviceRegistered();
    if (!currentDeviceId) {
      toast.error('Could not register your device. Please refresh and try again.');
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      setUploadProgress((current) => ({
        ...current,
        [file.name]: 0,
      }));

      const data = await new Promise<FileTransfer>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/api/file-transfers/upload`);
        xhr.responseType = 'json';
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
        xhr.setRequestHeader('X-File-Size', String(file.size));
        xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('X-Sender-Device-Id', currentDeviceId);
        xhr.setRequestHeader('X-Transfer-Method', transferMethod);
        if (targetDeviceId) {
          xhr.setRequestHeader('X-Receiver-Device-Id', targetDeviceId);
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress((current) => ({
            ...current,
            [file.name]: percent,
          }));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = xhr.response as FileTransfer;
            resolve(response);
            return;
          }

          const payload =
            typeof xhr.response === 'object' && xhr.response
              ? xhr.response
              : (() => {
                  try {
                    return JSON.parse(xhr.responseText);
                  } catch {
                    return null;
                  }
                })();

          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as Record<string, unknown>).error)
              : 'Failed to start file transfer';

          reject(new ApiError(message, xhr.status || 400));
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.onabort = () => {
          reject(new Error('Upload was cancelled'));
        };

        xhr.send(file);
      });

      await fetchTransfers();
      toast.success(`File transfer started: ${file.name}`);
      return data;
    } catch (err) {
      console.error('Start transfer error:', err);
      const message = err instanceof ApiError ? err.message : 'Failed to start file transfer';
      toast.error(message);
    } finally {
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[file.name];
        return next;
      });
      setLoading(false);
    }
  };

  // Cancel file transfer
  const cancelTransfer = async (transferId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch(`/api/file-transfers/${transferId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          transfer_status: 'cancelled'
        })
      });

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
      const response = await fetch(`${BASE_URL}/api/file-transfers/${transferId}/download`, {
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
    let active = true;

    const bootstrapTransfers = async () => {
      if (!user) {
        if (!active) return;
        cachedTransfers = [];
        cachedTransfersUserId = null;
        setTransfers([]);
        setLoading(false);
        return;
      }

      const shouldShowLoading = cachedTransfersUserId !== user.id && cachedTransfers.length === 0;
      setLoading(shouldShowLoading);
      await fetchTransfers();
      if (!active) return;
      cachedTransfersUserId = user.id;
      setLoading(false);
    };

    bootstrapTransfers();

    return () => {
      active = false;
    };
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
