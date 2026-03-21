import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useDevices } from './useDevices';
import { toast } from 'sonner';

export interface ClipboardItem {
  id: string;
  user_id: string;
  device_id: string;
  content: string;
  content_type: string;
  encrypted_content?: string;
  sync_timestamp: string;
  synced_to_devices: string[];
  created_at: string;
}

export const useClipboard = () => {
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentDevice } = useDevices();

  // Fetch clipboard history
  const fetchClipboardHistory = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/clipboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch clipboard error:', data.error);
        return;
      }

      setClipboardHistory(data || []);
    } catch (err) {
      console.error('Fetch clipboard error:', err);
    }
  };

  // Sync clipboard content
  const syncClipboard = async (content: string, contentType: string = 'text') => {
    if (!user || !currentDevice || !content.trim()) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      
      const response = await fetch('/api/clipboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: currentDevice.id,
          content,
          content_type: contentType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Sync clipboard error:', data.error);
        toast.error('Failed to sync clipboard');
        return;
      }

      await fetchClipboardHistory();
      toast.success('Clipboard synced successfully');
    } catch (err) {
      console.error('Sync clipboard error:', err);
      toast.error('Failed to sync clipboard');
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Copy to clipboard error:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Delete clipboard item
  const deleteClipboardItem = async (itemId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/clipboard/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Delete clipboard item error:', data.error);
        toast.error('Failed to delete clipboard item');
        return;
      }

      await fetchClipboardHistory();
      toast.success('Clipboard item deleted');
    } catch (err) {
      console.error('Delete clipboard item error:', err);
      toast.error('Failed to delete clipboard item');
    }
  };

  useEffect(() => {
    if (user) {
      fetchClipboardHistory();
    }
  }, [user]);

  return {
    clipboardHistory,
    loading,
    syncClipboard,
    copyToClipboard,
    deleteClipboardItem,
    fetchClipboardHistory
  };
};