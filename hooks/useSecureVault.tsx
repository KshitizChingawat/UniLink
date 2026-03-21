import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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
      const response = await fetch('/api/vault', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch vault items error:', data.error);
        return;
      }

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
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          item_type: itemType,
          encrypted_content: content,
          metadata,
          tags
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Add to vault error:', data.error);
        toast.error('Failed to add item to vault');
        return;
      }

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
      const response = await fetch(`/api/vault/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Remove from vault error:', data.error);
        toast.error('Failed to remove item from vault');
        return;
      }

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
    const item = vaultItems.find(v => v.id === itemId);
    if (item) {
      return {
        ...item,
        decrypted_content: item.encryptedContent // In real app, this would be decrypted
      };
    }
    return null;
  };

  const deleteVaultItem = async (itemId: string) => {
    await removeFromVault(itemId);
  };

  return {
    vaultItems,
    loading,
    storeSecurely,
    retrieveSecurely,
    deleteVaultItem,
    fetchVaultItems
  };
};