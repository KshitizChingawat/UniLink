import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

let cachedClipboardHistory: ClipboardItem[] = [];
let cachedClipboardUserId: string | null = null;

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
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>(cachedClipboardHistory);
  const [loading, setLoading] = useState(() => !cachedClipboardHistory.length);
  const { user } = useAuth();

  const getCurrentDeviceId = () => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('unilink_current_device');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      return parsed?.id || null;
    } catch {
      return null;
    }
  };

  // Fetch clipboard history
  const fetchClipboardHistory = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const data = await apiFetch<ClipboardItem[]>('/api/clipboard');
      cachedClipboardHistory = data || [];
      setClipboardHistory(cachedClipboardHistory);
    } catch (err) {
      console.error('Fetch clipboard error:', err);
    }
  };

  // Sync clipboard content
  const syncClipboard = async (content: string, contentType: string = 'text') => {
    const currentDeviceId = getCurrentDeviceId();
    if (!user || !currentDeviceId || !content.trim()) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      
      await apiFetch('/api/clipboard', {
        method: 'POST',
        body: JSON.stringify({
          device_id: currentDeviceId,
          content,
          content_type: contentType
        })
      });

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
      await apiFetch(`/api/clipboard/${itemId}`, {
        method: 'DELETE'
      });

      await fetchClipboardHistory();
      toast.success('Clipboard item deleted');
    } catch (err) {
      console.error('Delete clipboard item error:', err);
      toast.error('Failed to delete clipboard item');
    }
  };

  useEffect(() => {
    let active = true;

    const bootstrapClipboard = async () => {
      if (!user) {
        if (!active) return;
        cachedClipboardHistory = [];
        cachedClipboardUserId = null;
        setClipboardHistory([]);
        setLoading(false);
        return;
      }

      const shouldShowLoading = cachedClipboardUserId !== user.id && cachedClipboardHistory.length === 0;
      setLoading(shouldShowLoading);
      await fetchClipboardHistory();
      if (!active) return;
      cachedClipboardUserId = user.id;
      setLoading(false);
    };

    bootstrapClipboard();

    return () => {
      active = false;
    };
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
