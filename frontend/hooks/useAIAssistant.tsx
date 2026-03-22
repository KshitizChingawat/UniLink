import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AISuggestion {
  id: string;
  userId: string;
  suggestionType: 'clipboard_analysis' | 'file_organization' | 'device_recommendation' | 'workflow_automation' | 'content_categorization';
  content: any;
  confidenceScore: number | null;
  used: boolean;
  feedbackScore?: number | null;
  createdAt: string;
  expiresAt?: string | null;
}

export const useAIAssistant = () => {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const { user } = useAuth();

  // Fetch AI suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/ai-suggestions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch AI suggestions error:', data.error);
        return;
      }

      setSuggestions(data || []);
    } catch (err) {
      console.error('Fetch AI suggestions error:', err);
    }
  }, [user]);

  // Analyze clipboard content with enhanced AI
  const analyzeClipboardContent = async (content: string) => {
    if (!user || !assistantEnabled) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          type: 'clipboard_analysis',
          context: {
            timestamp: new Date().toISOString(),
            contentLength: content.length,
            userAgent: navigator.userAgent
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Analyze clipboard error:', data.error);
        return;
      }

      await fetchSuggestions();
      return data;
    } catch (err) {
      console.error('Analyze clipboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get file organization suggestions with enhanced context
  const getFileOrganizationSuggestion = async (fileName: string, fileType: string, fileSize: number) => {
    if (!user || !assistantEnabled) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: fileName,
          type: 'file_organization',
          context: {
            fileType,
            fileSize,
            timestamp: new Date().toISOString(),
            extension: fileName.split('.').pop()?.toLowerCase()
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('File organization suggestion error:', data.error);
        return;
      }

      await fetchSuggestions();
      return data;
    } catch (err) {
      console.error('File organization suggestion error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get device recommendations with enhanced logic
  const getDeviceRecommendations = async (deviceData: any) => {
    if (!user || !assistantEnabled) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: 'Device recommendation request',
          type: 'device_recommendation',
          context: {
            ...deviceData,
            timestamp: new Date().toISOString(),
            userPreferences: JSON.parse(localStorage.getItem('userPreferences') || '{}')
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Device recommendation error:', data.error);
        return;
      }

      return data;
    } catch (err) {
      console.error('Device recommendation error:', err);
    }
  };

  // Mark suggestion as used with enhanced feedback
  const markSuggestionUsed = async (suggestionId: string, feedbackScore?: number) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/ai-suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          used: true,
          feedback_score: feedbackScore,
          used_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Mark suggestion used error:', data.error);
        return;
      }

      await fetchSuggestions();
      toast.success('Feedback recorded - this helps improve AI suggestions');
    } catch (err) {
      console.error('Mark suggestion used error:', err);
    }
  };

  // Provide feedback on suggestions
  const provideFeedback = async (suggestionId: string, feedbackScore: number) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/ai-suggestions/${suggestionId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feedback_score: feedbackScore,
          feedback_timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Provide feedback error:', data.error);
        return;
      }

      await fetchSuggestions();
      toast.success(feedbackScore > 0 ? 'Thanks for the positive feedback!' : 'Feedback noted - we\'ll improve');
    } catch (err) {
      console.error('Provide feedback error:', err);
    }
  };

  // Dismiss suggestion
  const dismissSuggestion = async (suggestionId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/ai-suggestions/${suggestionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Dismiss suggestion error:', data.error);
        return;
      }

      await fetchSuggestions();
      toast.info('Suggestion dismissed');
    } catch (err) {
      console.error('Dismiss suggestion error:', err);
    }
  };

  // Toggle AI assistant with enhanced settings
  const toggleAssistant = (enabled: boolean) => {
    setAssistantEnabled(enabled);
    localStorage.setItem('aiAssistantEnabled', enabled.toString());
    
    // Save user preference to backend
    if (user) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ai_assistant_enabled: enabled
          })
        }).catch(console.error);
      }
    }
    
    toast.success(enabled ? 'AI Assistant enabled' : 'AI Assistant disabled');
  };

  // Get suggestions by type with filtering
  const getSuggestionsByType = (type: string, includeUsed: boolean = false) => {
    return suggestions.filter(s => 
      s.suggestionType === type && 
      (includeUsed || !s.used) &&
      (!s.expiresAt || new Date(s.expiresAt) > new Date())
    );
  };

  // Enhanced smart content analysis
  const getSmartContentAnalysis = (content: string) => {
    const analysis = {
      type: 'unknown',
      confidence: 0,
      suggestions: [] as string[],
      metadata: {} as any
    };

    // URL analysis with enhanced detection
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex);
    if (urls) {
      analysis.type = 'url';
      analysis.confidence = 0.9;
      analysis.suggestions = ['Save to bookmarks', 'Share with team', 'Archive for later', 'Open in browser'];
      analysis.metadata = { urls, count: urls.length };
    }
    // Email analysis with enhanced patterns
    else if (content.match(/[\w.-]+@[\w.-]+\.\w+/)) {
      analysis.type = 'email';
      analysis.confidence = 0.85;
      analysis.suggestions = ['Add to contacts', 'Send email', 'Save to CRM', 'Create calendar event'];
    }
    // Phone number analysis with international support
    else if (content.match(/[\+]?[\d\s\-\(\)]{10,}/)) {
      analysis.type = 'phone';
      analysis.confidence = 0.8;
      analysis.suggestions = ['Add to contacts', 'Make call', 'Send SMS', 'Save to address book'];
    }
    // Enhanced code detection
    else if (content.includes('function') || content.includes('class') || content.includes('import') || 
             content.includes('def ') || content.includes('public class') || content.includes('const ')) {
      analysis.type = 'code';
      analysis.confidence = 0.75;
      analysis.suggestions = ['Save as snippet', 'Format code', 'Share with team', 'Create gist'];
      
      // Detect programming language
      if (content.includes('def ') || content.includes('import ')) analysis.metadata.language = 'python';
      else if (content.includes('function') || content.includes('const ')) analysis.metadata.language = 'javascript';
      else if (content.includes('public class')) analysis.metadata.language = 'java';
    }
    // Address detection
    else if (content.match(/\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)/i)) {
      analysis.type = 'address';
      analysis.confidence = 0.7;
      analysis.suggestions = ['Open in maps', 'Save location', 'Get directions', 'Share location'];
    }
    // Enhanced text analysis
    else if (content.length > 50) {
      analysis.type = 'text';
      analysis.confidence = 0.6;
      analysis.suggestions = ['Save as note', 'Create task', 'Share', 'Translate'];
      
      // Detect if it's a task or todo
      if (content.toLowerCase().includes('todo') || content.toLowerCase().includes('task') || 
          content.toLowerCase().includes('remind')) {
        analysis.suggestions.unshift('Create reminder');
      }
    }

    return analysis;
  };

  // Get AI insights for user behavior
  const getAIInsights = () => {
    const insights = {
      mostUsedSuggestionType: '',
      averageConfidence: 0,
      totalSuggestions: suggestions.length,
      usageRate: 0,
      topActions: [] as string[]
    };

    if (suggestions.length === 0) return insights;

    // Calculate most used suggestion type
    const typeCount = suggestions.reduce((acc, s) => {
      acc[s.suggestionType] = (acc[s.suggestionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    insights.mostUsedSuggestionType = Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b
    );

    // Calculate average confidence
    insights.averageConfidence = suggestions.reduce((sum, s) => sum + (s.confidenceScore || 0), 0) / suggestions.length;

    // Calculate usage rate
    const usedSuggestions = suggestions.filter(s => s.used).length;
    insights.usageRate = usedSuggestions / suggestions.length;

    return insights;
  };

  // Initialize settings
  useEffect(() => {
    const savedEnabled = localStorage.getItem('aiAssistantEnabled');
    if (savedEnabled !== null) {
      setAssistantEnabled(savedEnabled === 'true');
    }
  }, []);

  useEffect(() => {
    if (user && assistantEnabled) {
      fetchSuggestions();
    }
  }, [user, assistantEnabled, fetchSuggestions]);

  return {
    suggestions,
    loading,
    assistantEnabled,
    analyzeClipboardContent,
    getFileOrganizationSuggestion,
    getDeviceRecommendations,
    markSuggestionUsed,
    provideFeedback,
    dismissSuggestion,
    toggleAssistant,
    getSuggestionsByType,
    getSmartContentAnalysis,
    getAIInsights,
    fetchSuggestions
  };
};