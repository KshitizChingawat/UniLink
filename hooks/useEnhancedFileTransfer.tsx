import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useDevices } from './useDevices';
import { useFileTransfer } from './useFileTransfer';
import { useSmartSync } from './useSmartSync';
import { toast } from 'sonner';

export const useEnhancedFileTransfer = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  
  const { user } = useAuth();
  const { devices, currentDevice } = useDevices();
  const { startFileTransfer, transfers, formatFileSize } = useFileTransfer();
  const { getSmartFileOrganization, analyzeClipboardContent } = useSmartSync();

  // Enhanced file transfer with smart features
  const uploadFile = async (
    file: File, 
    targetDeviceId?: string, 
    onProgress?: (progress: number) => void,
    options: {
      compress?: boolean;
      encrypt?: boolean;
      priority?: 'low' | 'medium' | 'high';
      autoRetry?: boolean;
    } = {}
  ) => {
    if (!user || !currentDevice) return null;

    try {
      setIsProcessing(true);

      // Simulate upload progress
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          setTimeout(() => onProgress(i), i * 50);
        }
      }

      // Apply compression if enabled
      let processedFile = file;
      if (options.compress && compressionEnabled) {
        processedFile = await compressFile(file);
      }

      // Start the transfer with enhanced options
      const transferData = await startFileTransfer(
        processedFile,
        targetDeviceId,
        'cloud'
      );

      if (transferData) {
        toast.success('Enhanced file transfer started');
        return transferData;
      }
    } catch (err) {
      console.error('Enhanced transfer error:', err);
      toast.error('Enhanced file transfer failed');
    } finally {
      setIsProcessing(false);
    }

    return null;
  };

  const downloadFile = async (transferId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

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

  // Batch file transfer
  const batchFileTransfer = async (
    files: File[],
    targetDeviceId?: string,
    options?: any
  ) => {
    if (!files.length) return;

    setIsProcessing(true);
    const results = [];

    try {
      for (const file of files) {
        const result = await uploadFile(file, targetDeviceId, undefined, options);
        if (result) {
          results.push(result);
        }
        
        // Small delay between transfers to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Batch transfer started: ${results.length} files`);
      return results;
    } catch (err) {
      console.error('Batch transfer error:', err);
      toast.error('Batch transfer failed');
    } finally {
      setIsProcessing(false);
    }

    return results;
  };

  // Compress file (simplified compression simulation)
  const compressFile = async (file: File): Promise<File> => {
    // For demo purposes, we'll simulate compression
    // In a real app, you'd use libraries like pako, fflate, etc.
    
    if (file.type.startsWith('image/')) {
      // Simulate image compression (reduce quality)
      return new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified
      });
    }
    
    if (file.type.startsWith('text/') || file.name.endsWith('.json')) {
      // Simulate text compression
      try {
        const text = await file.text();
        const compressed = text.replace(/\s+/g, ' ').trim();
        const blob = new Blob([compressed], { type: file.type });
        return new File([blob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });
      } catch (err) {
        return file;
      }
    }

    return file;
  };

  // Smart file categorization
  const categorizeFiles = (files: File[]) => {
    const categories = {
      images: [] as File[],
      documents: [] as File[],
      media: [] as File[],
      archives: [] as File[],
      code: [] as File[],
      other: [] as File[]
    };

    files.forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
        categories.images.push(file);
      } else if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
        categories.documents.push(file);
      } else if (['mp4', 'avi', 'mov', 'mp3', 'wav'].includes(extension)) {
        categories.media.push(file);
      } else if (['zip', 'rar', '7z', 'tar'].includes(extension)) {
        categories.archives.push(file);
      } else if (['js', 'ts', 'py', 'java', 'cpp', 'html', 'css'].includes(extension)) {
        categories.code.push(file);
      } else {
        categories.other.push(file);
      }
    });

    return categories;
  };

  // Get transfer recommendations
  const getTransferRecommendations = (file: File, targetDevices: any[]) => {
    const recommendations = [];
    
    // Size-based recommendations
    if (file.size > 100 * 1024 * 1024) { // > 100MB
      recommendations.push({
        type: 'compression',
        message: 'Consider compressing large files',
        action: 'enable_compression'
      });
    }

    // Device-based recommendations
    const mobileDevices = targetDevices.filter(d => d.deviceType === 'mobile');
    if (mobileDevices.length > 0 && file.size > 50 * 1024 * 1024) {
      recommendations.push({
        type: 'device',
        message: 'Large file for mobile device',
        action: 'suggest_wifi'
      });
    }

    // File type recommendations
    if (file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) {
      recommendations.push({
        type: 'optimization',
        message: 'Image can be optimized',
        action: 'optimize_image'
      });
    }

    return recommendations;
  };

  // Queue management
  const addToQueue = (files: File[]) => {
    setUploadQueue(prev => [...prev, ...files]);
    toast.info(`Added ${files.length} file(s) to queue`);
  };

  const processQueue = async (targetDeviceId?: string) => {
    if (uploadQueue.length === 0) return;

    const filesToProcess = [...uploadQueue];
    setUploadQueue([]);

    await batchFileTransfer(filesToProcess, targetDeviceId);
  };

  const clearQueue = () => {
    setUploadQueue([]);
    toast.info('Upload queue cleared');
  };

  // Transfer analytics
  const getTransferAnalytics = () => {
    const analytics = {
      totalTransfers: transferHistory.length,
      totalSize: transferHistory.reduce((sum, t) => sum + (t.originalSize || 0), 0),
      compressionSaved: transferHistory.reduce((sum, t) => {
        return sum + ((t.originalSize || 0) - (t.processedSize || 0));
      }, 0),
      averageSpeed: 0,
      successRate: 0
    };

    const completedTransfers = transfers.filter(t => t.transfer_status === 'completed');
    analytics.successRate = transfers.length > 0 ? (completedTransfers.length / transfers.length) * 100 : 0;

    return analytics;
  };

  // Settings management
  const updateSettings = (settings: {
    compression?: boolean;
    encryption?: boolean;
    autoRetry?: boolean;
  }) => {
    if (settings.compression !== undefined) {
      setCompressionEnabled(settings.compression);
      localStorage.setItem('fileTransferCompression', settings.compression.toString());
    }
    if (settings.encryption !== undefined) {
      setEncryptionEnabled(settings.encryption);
      localStorage.setItem('fileTransferEncryption', settings.encryption.toString());
    }
    if (settings.autoRetry !== undefined) {
      setAutoRetryEnabled(settings.autoRetry);
      localStorage.setItem('fileTransferAutoRetry', settings.autoRetry.toString());
    }
    
    toast.success('Transfer settings updated');
  };

  // Load settings from localStorage
  useEffect(() => {
    const compression = localStorage.getItem('fileTransferCompression');
    const encryption = localStorage.getItem('fileTransferEncryption');
    const autoRetry = localStorage.getItem('fileTransferAutoRetry');

    if (compression !== null) setCompressionEnabled(compression === 'true');
    if (encryption !== null) setEncryptionEnabled(encryption === 'true');
    if (autoRetry !== null) setAutoRetryEnabled(autoRetry === 'true');
  }, []);

  return {
    isProcessing,
    uploadProgress: {},
    downloadProgress: {},
    compressionEnabled,
    encryptionEnabled,
    autoRetryEnabled,
    uploadQueue,
    transfers,
    uploadFile,
    downloadFile,
    batchFileTransfer,
    categorizeFiles,
    getTransferRecommendations,
    addToQueue,
    processQueue,
    clearQueue,
    getTransferAnalytics,
    updateSettings,
    formatFileSize
  };
};