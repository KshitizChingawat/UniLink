import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Lightbulb, 
  Zap, 
  ThumbsUp, 
  ThumbsDown, 
  Clock,
  Sparkles,
  Target,
  TrendingUp,
  BarChart3,
  Settings
} from 'lucide-react';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useSmartSync } from '@/hooks/useSmartSync';

const AIAssistantPanel = () => {
  const { 
    suggestions, 
    fetchSuggestions, 
    markSuggestionUsed, 
    provideFeedback,
    loading,
    assistantEnabled,
    toggleAssistant,
    getAIInsights,
    getSuggestionsByType
  } = useAIAssistant();
  
  const {
    smartSuggestionsEnabled,
    setSmartSuggestionsEnabled,
    autoSyncEnabled,
    setAutoSyncEnabled,
    processingQueue
  } = useSmartSync();

  const [insights, setInsights] = useState<any>({});
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    setInsights(getAIInsights());
  }, [suggestions, getAIInsights]);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'clipboard_analysis': return <Lightbulb className="w-4 h-4" />;
      case 'file_organization': return <Target className="w-4 h-4" />;
      case 'device_recommendation': return <Zap className="w-4 h-4" />;
      case 'workflow_automation': return <Settings className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getSuggestionColor = (confidence: number | null) => {
    if (!confidence) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const filteredSuggestions = selectedType === 'all' 
    ? suggestions.slice(0, 10) 
    : getSuggestionsByType(selectedType).slice(0, 10);

  const suggestionTypes = [
    { key: 'all', label: 'All Suggestions', count: suggestions.length },
    { key: 'clipboard_analysis', label: 'Clipboard', count: getSuggestionsByType('clipboard_analysis').length },
    { key: 'file_organization', label: 'Files', count: getSuggestionsByType('file_organization').length },
    { key: 'device_recommendation', label: 'Devices', count: getSuggestionsByType('device_recommendation').length },
    { key: 'workflow_automation', label: 'Workflow', count: getSuggestionsByType('workflow_automation').length }
  ];

  return (
    <div className="space-y-6">
      {/* AI Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-unilink-600" />
            <span>AI Assistant</span>
            <Badge variant={assistantEnabled ? "default" : "secondary"}>
              {assistantEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Intelligent automation and smart suggestions for your cross-device workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">AI Assistant</p>
              <p className="text-xs text-gray-500">
                Enable AI-powered analysis and suggestions
              </p>
            </div>
            <Switch
              checked={assistantEnabled}
              onCheckedChange={toggleAssistant}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Smart Suggestions</p>
              <p className="text-xs text-gray-500">
                Get AI-powered recommendations for clipboard, files, and devices
              </p>
            </div>
            <Switch
              checked={smartSuggestionsEnabled}
              onCheckedChange={setSmartSuggestionsEnabled}
              disabled={!assistantEnabled}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Auto Sync</p>
              <p className="text-xs text-gray-500">
                Automatically sync clipboard changes across devices
              </p>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>

          {processingQueue > 0 && (
            <>
              <Separator />
              <div className="flex items-center space-x-2 text-sm text-unilink-600">
                <Clock className="w-4 h-4" />
                <span>{processingQueue} items in processing queue</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      {assistantEnabled && insights.totalSuggestions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-unilink-600" />
              <span>AI Insights</span>
            </CardTitle>
            <CardDescription>
              Your AI assistant performance and usage patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-unilink-600">{insights.totalSuggestions}</div>
                <div className="text-xs text-gray-500">Total Suggestions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((insights.usageRate || 0) * 100)}%
                </div>
                <div className="text-xs text-gray-500">Usage Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((insights.averageConfidence || 0) * 100)}%
                </div>
                <div className="text-xs text-gray-500">Avg Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {insights.mostUsedSuggestionType?.replace('_', ' ') || 'N/A'}
                </div>
                <div className="text-xs text-gray-500">Top Category</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI Learning Progress</span>
                <span>{Math.round((insights.usageRate || 0) * 100)}%</span>
              </div>
              <Progress value={(insights.usageRate || 0) * 100} className="h-2" />
              <p className="text-xs text-gray-500">
                Based on your feedback, the AI is learning your preferences
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestion Type Filter */}
      {assistantEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-unilink-600" />
                <span>Smart Suggestions</span>
              </div>
              <Badge variant="secondary">
                {suggestions.filter(s => !s.used).length} new
              </Badge>
            </CardTitle>
            <CardDescription>
              AI-powered suggestions to improve your productivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestionTypes.map((type) => (
                <Button
                  key={type.key}
                  variant={selectedType === type.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type.key)}
                  className="flex items-center space-x-1"
                >
                  <span>{type.label}</span>
                  {type.count > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {type.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-unilink-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Generating suggestions...</p>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedType === 'all' ? 'No suggestions yet' : `No ${selectedType.replace('_', ' ')} suggestions`}
                </h3>
                <p className="text-gray-600 text-sm">
                  {selectedType === 'all' 
                    ? 'Start using UniLink and AI will learn your patterns to provide helpful suggestions'
                    : 'Use more features to get AI suggestions in this category'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-4 rounded-lg border transition-all duration-200 ${
                      suggestion.used 
                        ? 'bg-gray-50 border-gray-200 opacity-75' 
                        : 'bg-white border-gray-300 hover:border-unilink-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getSuggestionIcon(suggestion.suggestionType)}
                        <span className="text-sm font-medium capitalize">
                          {suggestion.suggestionType.replace('_', ' ')}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getSuggestionColor(suggestion.confidenceScore)}`}
                        >
                          {Math.round((suggestion.confidenceScore || 0) * 100)}% confident
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(suggestion.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-sm text-gray-700 mb-3">
                      {suggestion.content.summary || 
                       suggestion.content.reason || 
                       suggestion.content.description ||
                       'AI suggestion'}
                    </div>

                    {suggestion.content.actions && suggestion.content.actions.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Suggested actions:</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.content.actions.slice(0, 3).map((action: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {!suggestion.used ? (
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => markSuggestionUsed(suggestion.id, 1)}
                          className="flex items-center space-x-1"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Helpful</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => provideFeedback(suggestion.id, -1)}
                          className="flex items-center space-x-1"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>Not helpful</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          Used
                        </Badge>
                        {suggestion.feedbackScore && (
                          <Badge 
                            variant={suggestion.feedbackScore > 0 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {suggestion.feedbackScore > 0 ? 'Helpful' : 'Not helpful'}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {suggestions.length > 10 && (
                  <Button variant="outline" className="w-full">
                    View All Suggestions ({suggestions.length})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIAssistantPanel;