import { useState, useEffect, useCallback } from 'react';
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
  const proActive =
    user?.plan === 'pro' &&
    (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() > Date.now());
  const clipboardWordLimit = proActive ? 5000 : 100;
  const clipboardMessageLimit = proActive ? null : 10;

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
  const fetchClipboardHistory = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const data = await apiFetch<ClipboardItem[]>('/api/clipboard');
      cachedClipboardHistory = data || [];
      cachedClipboardUserId = user.id;
      setClipboardHistory(cachedClipboardHistory);
    } catch (err) {
      console.error('Fetch clipboard error:', err);
    }
  }, [user]);

  // Sync clipboard content
  const syncClipboard = async (content: string, contentType: string = 'text') => {
    const currentDeviceId = getCurrentDeviceId();
    if (!user || !currentDeviceId || !content.trim()) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > clipboardWordLimit) {
        toast.error(
          proActive
            ? 'Pro clipboard messages can contain up to 5000 words.'
            : 'Free plan clipboard messages can contain up to 100 words. Upgrade to Pro for 5000-word messages.',
        );
        return;
      }

      if (!proActive && clipboardHistory.length >= 10) {
        toast.error('Free plan allows up to 10 clipboard messages. Delete an old one or upgrade to Pro.');
        return;
      }

      setLoading(true);

      const createdItem = await apiFetch<ClipboardItem>('/api/clipboard', {
        method: 'POST',
        body: JSON.stringify({
          device_id: currentDeviceId,
          content,
          content_type: contentType
        })
      });

      cachedClipboardHistory = [createdItem, ...cachedClipboardHistory.filter((item) => item.id !== createdItem.id)];
      cachedClipboardUserId = user.id;
      setClipboardHistory(cachedClipboardHistory);
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

    const previousClipboardHistory = cachedClipboardHistory;
    const nextClipboardHistory = cachedClipboardHistory.filter((item) => item.id !== itemId);

    try {
      cachedClipboardHistory = nextClipboardHistory;
      setClipboardHistory(nextClipboardHistory);

      await apiFetch(`/api/clipboard/${itemId}`, {
        method: 'DELETE'
      });

      toast.success('Clipboard item deleted');
    } catch (err) {
      cachedClipboardHistory = previousClipboardHistory;
      setClipboardHistory(previousClipboardHistory);
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
  }, [user, fetchClipboardHistory]);

  useEffect(() => {
    if (!user) return;

    const refreshClipboard = () => {
      fetchClipboardHistory().catch(() => undefined);
    };

    const interval = window.setInterval(refreshClipboard, 3000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshClipboard();
      }
    };

    window.addEventListener('focus', refreshClipboard);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshClipboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchClipboardHistory]);

  return {
    clipboardHistory,
    loading,
    clipboardWordLimit,
    clipboardMessageLimit,
    proActive,
    syncClipboard,
    copyToClipboard,
    deleteClipboardItem,
    fetchClipboardHistory
  };
};
