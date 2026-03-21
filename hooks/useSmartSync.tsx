import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useClipboard } from './useClipboard';
import { useFileTransfer } from './useFileTransfer';
import { toast } from 'sonner';

export const useSmartSync = () => {
  const [smartSuggestionsEnabled, setSmartSuggestionsEnabled] = useState(true);
  const [processingQueue, setProcessingQueue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [preferences, setPreferences] = useState({
    autoClipboard: true,
    autoFiles: true,
    smartSuggestions: true,
    syncFrequency: 5000
  });
  const { user } = useAuth();
  const { clipboardHistory } = useClipboard();
  const { transfers } = useFileTransfer();

  // Get smart file organization suggestions
  const getSmartFileOrganization = async (file: File) => {
    if (!user) return null;

    try {
      const suggestions = {
        suggestedFolder: getFileCategory(file.name, file.type),
        tags: generateFileTags(file.name, file.type),
        priority: calculateFilePriority(file.size, file.type),
        autoActions: getAutoActions(file.type)
      };

      return suggestions;
    } catch (err) {
      console.error('Smart organization error:', err);
      return null;
    }
  };

  // Get file category based on type and name
  const getFileCategory = (fileName: string, fileType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      return 'Images';
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
      return 'Videos';
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) {
      return 'Audio';
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return 'Documents';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      return 'Archives';
    }
    if (['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm'].includes(extension)) {
      return 'Applications';
    }
    
    return 'Other';
  };

  // Generate smart tags for files
  const generateFileTags = (fileName: string, fileType: string) => {
    const tags = [];
    const name = fileName.toLowerCase();
    
    if (name.includes('screenshot')) tags.push('screenshot');
    if (name.includes('photo')) tags.push('photo');
    if (name.includes('document')) tags.push('document');
    if (name.includes('download')) tags.push('download');
    if (name.includes('work')) tags.push('work');
    if (name.includes('personal')) tags.push('personal');
    if (name.includes('backup')) tags.push('backup');
    if (name.includes('temp')) tags.push('temporary');
    
    // Add date-based tags
    const now = new Date();
    tags.push(`${now.getFullYear()}`);
    tags.push(`${now.toLocaleString('default', { month: 'long' })}`);
    
    return tags;
  };

  // Calculate file priority
  const calculateFilePriority = (fileSize: number, fileType: string) => {
    if (fileSize > 100 * 1024 * 1024) return 'high'; // Files > 100MB
    if (fileType.includes('image') || fileType.includes('video')) return 'medium';
    return 'low';
  };

  // Get auto actions for file types
  const getAutoActions = (fileType: string) => {
    const actions = [];
    
    if (fileType.includes('image')) {
      actions.push('compress', 'backup');
    }
    if (fileType.includes('document')) {
      actions.push('backup', 'sync');
    }
    if (fileType.includes('video')) {
      actions.push('compress');
    }
    
    return actions;
  };

  // Analyze clipboard content for smart suggestions
  const analyzeClipboardContent = (content: string) => {
    const suggestions = [];
    
    // URL detection
    if (content.match(/https?:\/\/[^\s]+/)) {
      suggestions.push({
        type: 'url',
        action: 'bookmark',
        description: 'Save this URL to bookmarks',
        content: content
      });
    }
    
    // Email detection
    if (content.match(/[\w.-]+@[\w.-]+\.\w+/)) {
      suggestions.push({
        type: 'email',
        action: 'contact',
        description: 'Add to contacts',
        content: content
      });
    }
    
    // Phone number detection
    if (content.match(/[\+]?[\d\s\-\(\)]{10,}/)) {
      suggestions.push({
        type: 'phone',
        action: 'contact',
        description: 'Add to contacts',
        content: content
      });
    }
    
    // Code detection
    if (content.includes('function') || content.includes('class') || content.includes('import')) {
      suggestions.push({
        type: 'code',
        action: 'save',
        description: 'Save to code snippets',
        content: content
      });
    }
    
    return suggestions;
  };

  // Get sync recommendations
  const getSyncRecommendations = () => {
    const recommendations = [];
    
    // Based on clipboard history
    if (clipboardHistory.length > 10) {
      recommendations.push({
        type: 'cleanup',
        priority: 'medium',
        description: 'Clean up old clipboard items',
        action: 'cleanup_clipboard'
      });
    }
    
    // Based on file transfers
    const pendingTransfers = transfers.filter(t => t.transfer_status === 'pending');
    if (pendingTransfers.length > 0) {
      recommendations.push({
        type: 'transfer',
        priority: 'high',
        description: `${pendingTransfers.length} file transfers pending`,
        action: 'check_transfers'
      });
    }
    
    // Storage optimization
    const totalFiles = transfers.length;
    if (totalFiles > 50) {
      recommendations.push({
        type: 'storage',
        priority: 'medium',
        description: 'Consider archiving old files',
        action: 'archive_files'
      });
    }
    
    return recommendations;
  };

  // Enable/disable auto sync
  const toggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('autoSyncEnabled', enabled.toString());
    toast.success(enabled ? 'Auto sync enabled' : 'Auto sync disabled');
  };

  // Update preferences
  const updatePreferences = (newPreferences: Partial<typeof preferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('syncPreferences', JSON.stringify(updated));
    toast.success('Preferences updated');
  };

  // Get device sync status
  const getDeviceSyncStatus = () => {
    return {
      lastSync: new Date().toISOString(),
      syncedItems: clipboardHistory.length + transfers.length,
      pendingItems: transfers.filter(t => t.transfer_status === 'pending').length,
      errors: 0
    };
  };

  // Initialize preferences from localStorage
  useEffect(() => {
    const savedAutoSync = localStorage.getItem('autoSyncEnabled');
    const savedPreferences = localStorage.getItem('syncPreferences');
    
    if (savedAutoSync) {
      setAutoSyncEnabled(savedAutoSync === 'true');
    }
    
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (err) {
        console.error('Failed to parse saved preferences:', err);
      }
    }
  }, []);

  // Update suggestions based on content changes
  useEffect(() => {
    if (user && smartSuggestionsEnabled) {
      setProcessingQueue(transfers.filter(t => t.transfer_status === 'pending').length);
    }
  }, [user, clipboardHistory, transfers, smartSuggestionsEnabled]);

  return {
    smartSuggestionsEnabled,
    setSmartSuggestionsEnabled,
    processingQueue,
    loading,
    autoSyncEnabled,
    setAutoSyncEnabled,
    preferences,
    getSmartFileOrganization,
    analyzeClipboardContent,
    getSyncRecommendations,
    toggleAutoSync,
    updatePreferences,
    getDeviceSyncStatus
  };
};