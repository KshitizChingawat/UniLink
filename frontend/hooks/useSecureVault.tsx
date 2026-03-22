import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export interface VaultItem {
  id: string;
  user_id: string;
  item_type: 'clipboard' | 'file' | 'note';
  encrypted_content: string;
  metadata?: any;
  tags: string[];
  created_at: string;
  accessed_at: string;
}

export const useSecureVault = () => {
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Fetch vault items
  const fetchVaultItems = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const data = await apiFetch<VaultItem[]>('/api/vault');
      setVaultItems(data || []);
    } catch (err) {
      console.error('Fetch vault items error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add item to vault
  const addToVault = async (itemType: 'clipboard' | 'file' | 'note', content: string, metadata?: any, tags: string[] = []) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch('/api/vault', {
        method: 'POST',
        body: JSON.stringify({
          item_type: itemType,
          encrypted_content: content,
          metadata,
          tags
        })
      });

      await fetchVaultItems();
      toast.success('Item added to vault');
    } catch (err) {
      console.error('Add to vault error:', err);
      toast.error('Failed to add item to vault');
    }
  };

  // Remove item from vault
  const removeFromVault = async (itemId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch(`/api/vault/${itemId}`, {
        method: 'DELETE'
      });

      await fetchVaultItems();
      toast.success('Item removed from vault');
    } catch (err) {
      console.error('Remove from vault error:', err);
      toast.error('Failed to remove item from vault');
    }
  };

  useEffect(() => {
    if (user) {
      fetchVaultItems();
    }
  }, [user]);

  const retrieveSecurely = async (itemId: string) => {
    try {
      return await apiFetch(`/api/vault/${itemId}`);
    } catch (error) {
      console.error('Retrieve vault item error:', error);
      toast.error('Failed to open vault item');
      return null;
    }
  };

  const deleteVaultItem = async (itemId: string) => {
    await removeFromVault(itemId);
  };

  return {
    vaultItems,
    loading,
    storeSecurely: addToVault,
    addToVault,
    retrieveSecurely,
    deleteVaultItem,
    fetchVaultItems
  };
};
