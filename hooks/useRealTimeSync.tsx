import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useDevices } from './useDevices';
import { toast } from 'sonner';

interface SyncEvent {
  type: string;
  data: any;
  timestamp: number;
  deviceId?: string;
}

export const useRealTimeSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncEvent[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { currentDevice } = useDevices();

  // Enhanced connection management
  const initializeConnection = useCallback(() => {
    if (!user || !currentDevice) return;

    // Simulate connection for demo
    setTimeout(() => {
      setIsConnected(true);
      setSyncStatus('connected');
      setConnectionAttempts(0);
      setLastSyncTime(new Date());
    }, 1000);
  }, [user, currentDevice]);

  // Enhanced reconnection logic with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000); // Max 30 seconds
    setConnectionAttempts(prev => prev + 1);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (user && currentDevice && !isConnected) {
        console.log(`Attempting to reconnect (attempt ${connectionAttempts + 1})`);
        initializeConnection();
      }
    }, delay);
  }, [connectionAttempts, user, currentDevice, isConnected, initializeConnection]);

  // Heartbeat mechanism
  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
          deviceId: currentDevice?.id
        }));
      }
    }, 30000); // Every 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Enhanced message handling
  const handleWebSocketMessage = (message: any) => {
    // Simulate message handling for demo
    console.log('Received message:', message);
  };

  // Enhanced clipboard sync handling
  const handleClipboardSync = (data: any) => {
    if (data.deviceId !== currentDevice?.id) {
      const notification = `Clipboard updated from ${data.deviceName}`;
      
      // Show notification with action
      toast.info(notification, {
        action: {
          label: 'Copy',
          onClick: () => {
            if (navigator.clipboard && data.content) {
              navigator.clipboard.writeText(data.content).catch(console.error);
              toast.success('Copied to clipboard');
            }
          }
        }
      });
      
      // Auto-copy if enabled in settings
      const autoClipboard = localStorage.getItem('autoClipboardSync') === 'true';
      if (autoClipboard && navigator.clipboard && data.content) {
        navigator.clipboard.writeText(data.content).catch(console.error);
      }
    }
  };

  // Enhanced file transfer handling
  const handleFileTransferUpdate = (data: any) => {
    const { transferId, status, progress, fileName, deviceName } = data;
    
    switch (status) {
      case 'completed':
        toast.success(`File transfer completed: ${fileName}`, {
          action: {
            label: 'View',
            onClick: () => {
              // Navigate to file transfers page
              window.location.href = '/dashboard/files';
            }
          }
        });
        break;
        
      case 'failed':
        toast.error(`File transfer failed: ${fileName}`);
        break;
        
      case 'in_progress':
        if (progress && progress % 25 === 0) { // Show progress every 25%
          toast.info(`Transfer progress: ${Math.round(progress)}% - ${fileName}`);
        }
        break;
        
      case 'received':
        toast.success(`File received from ${deviceName}: ${fileName}`, {
          action: {
            label: 'Download',
            onClick: () => {
              // Trigger download
              window.open(`/api/file-transfers/${transferId}/download`, '_blank');
            }
          }
        });
        break;
    }
  };

  // Enhanced device update handling
  const handleDeviceUpdate = (data: any) => {
    const { deviceName, status, deviceType } = data;
    
    switch (status) {
      case 'online':
        toast.info(`${deviceName} (${deviceType}) came online`, {
          action: {
            label: 'View Devices',
            onClick: () => {
              window.location.href = '/dashboard/devices';
            }
          }
        });
        break;
        
      case 'offline':
        toast.info(`${deviceName} went offline`);
        break;
        
      case 'low_battery':
        toast.warning(`${deviceName} has low battery`);
        break;
    }
  };

  // Enhanced AI suggestion handling
  const handleAISuggestion = (data: any) => {
    if (data.confidence > 0.8) {
      toast.info(`AI Suggestion: ${data.description}`, {
        action: {
          label: 'View',
          onClick: () => {
            window.location.href = '/dashboard/smart-sync';
          }
        }
      });
    }
  };

  // Enhanced message sending with retry logic
  const sendSyncMessage = (type: string, data: any, priority: 'low' | 'medium' | 'high' = 'medium') => {
    const message: SyncEvent = {
      type,
      data: {
        ...data,
        deviceId: currentDevice?.id,
        timestamp: Date.now(),
        priority
      },
      timestamp: Date.now(),
      deviceId: currentDevice?.id
    };

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      setSyncQueue(prev => {
        const newQueue = [...prev, message];
        // Limit queue size and prioritize high priority messages
        return newQueue
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.data.priority] - priorityOrder[a.data.priority];
          })
          .slice(0, 100); // Max 100 queued messages
      });
      return;
    }

    setSyncStatus('syncing');
    
    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      setSyncQueue(prev => [...prev, message]);
    }
  };

  // Process queued messages with priority
  const processQueuedMessages = () => {
    if (syncQueue.length > 0 && isConnected) {
      const queue = [...syncQueue];
      setSyncQueue([]);
      
      queue.forEach((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify(message));
          } catch (error) {
            console.error('Failed to send queued message:', error);
          }
        }
      });
    }
  };

  // Enhanced sync methods
  const syncClipboard = (content: string, contentType: string = 'text') => {
    // Simulate clipboard sync
    toast.success('Clipboard synced across devices');
  };

  const syncFileTransfer = (transferData: any) => {
    // Simulate file transfer sync
    toast.info('File transfer synchronized');
  };

  const syncDeviceStatus = (status: 'online' | 'offline' | 'busy' | 'low_battery') => {
    // Simulate device status sync
    console.log('Device status updated:', status);
  };

  // Enhanced sync statistics
  const getSyncStats = () => {
    return {
      isOnline,
      isConnected,
      status: syncStatus,
      lastSync: lastSyncTime,
      queuedItems: syncQueue.length,
      connectionAttempts,
      uptime: lastSyncTime ? Date.now() - lastSyncTime.getTime() : 0,
      highPriorityQueued: syncQueue.filter(m => m.data.priority === 'high').length
    };
  };

  // Manual sync with enhanced error handling
  const triggerManualSync = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setSyncStatus('syncing');
      
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: currentDevice?.id,
          timestamp: Date.now(),
          force: true
        })
      });

      if (response.ok) {
        setLastSyncTime(new Date());
        toast.success('Manual sync completed');
      } else {
        const errorData = await response.json();
        toast.error(`Manual sync failed: ${errorData.message}`);
      }
    } catch (err) {
      console.error('Manual sync error:', err);
      toast.error('Manual sync failed - check your connection');
    } finally {
      setSyncStatus(isConnected ? 'connected' : 'idle');
    }
  };

  // Enhanced cleanup
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    setIsConnected(false);
    setSyncStatus('idle');
  };

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user && currentDevice && !isConnected) {
        initializeConnection();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, currentDevice, isConnected, initializeConnection]);

  // Initialize connection when user and device are available
  useEffect(() => {
    if (user && currentDevice && isOnline) {
      initializeConnection();
    }

    return () => {
      disconnect();
    };
  }, [user, currentDevice, isOnline, initializeConnection]);

  // Process queued messages when connected
  useEffect(() => {
    if (isConnected) {
      processQueuedMessages();
    }
  }, [isConnected]);

  return {
    isOnline,
    isConnected,
    syncStatus,
    lastSyncTime,
    syncQueue: syncQueue.length,
    connectionAttempts,
    syncClipboard,
    syncFileTransfer,
    syncDeviceStatus,
    triggerManualSync,
    getSyncStats,
    disconnect
  };
};