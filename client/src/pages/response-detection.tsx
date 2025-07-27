import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  MessageSquare, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Phone,
  Linkedin,
  MessageCircle,
  Brain,
  Target,
  Lightbulb,
  Activity,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Settings,
  Play,
  Pause,
  Download,
  Upload,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface ResponseDetectionDashboard {
  recentResponses: any[];
  analytics: {
    totalResponses: number;
    sentimentDistribution: any[];
    categoryDistribution: any[];
    responseRates: any[];
    positiveResponseRate: number;
    averageSentimentScore: number;
  };
  insights: any[];
  summary: {
    totalResponses: number;
    positiveResponseRate: number;
    averageSentimentScore: number;
    pendingActions: number;
  };
}

const COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#f59e0b'
};

const SENTIMENT_COLORS = [COLORS.positive, COLORS.negative, COLORS.neutral];

export default function ResponseDetection() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [sampleText, setSampleText] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<'positive' | 'negative' | 'neutral' | ''>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: dashboardData, isLoading: loadingDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/response-detection/dashboard', selectedCampaign],
    enabled: activeTab === 'dashboard'
  });

  // Fetch responses with analysis
  const { data: responsesData, isLoading: loadingResponses, refetch: refetchResponses } = useQuery({
    queryKey: ['/api/response-detection/responses', selectedCampaign, sentimentFilter, dateRange],
    enabled: activeTab === 'responses'
  });

  // Fetch analytics
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['/api/response-detection/analytics', selectedCampaign],
    enabled: activeTab === 'analytics'
  });

  // Fetch optimization insights
  const { data: optimizationData, isLoading: loadingOptimization } = useQuery({
    queryKey: ['/api/response-detection/insights', selectedCampaign],
    enabled: activeTab === 'optimization'
  });

  // Sample analysis mutation
  const analyzeSampleMutation = useMutation({
    mutationFn: async (responseText: string) => {
      return apiRequest('/api/response-detection/analyze-sample', 'POST', { responseText });
    },
    onSuccess: () => {
      toast({
        title: "Analysis Complete",
        description: "Response sentiment and intent analyzed successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Execute action mutation
  const executeActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest(`/api/response-detection/actions/${actionId}/execute`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Action Executed",
        description: "Automated action completed successfully"
      });
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleAnalyzeSample = () => {
    if (!sampleText.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter response text to analyze",
        variant: "destructive"
      });
      return;
    }
    analyzeSampleMutation.mutate(sampleText);
  };

  const handleExecuteAction = (actionId: string) => {
    executeActionMutation.mutate(actionId);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case 'negative': return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentBadgeColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'negative': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getResponseTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'linkedin': return <Linkedin className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'chat': return <MessageCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'medium': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="response-detection-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
            Response Detection
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="page-description">
            AI-powered response detection with sentiment analysis and automated actions
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => refetchDashboard()}
            disabled={loadingDashboard}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingDashboard ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-48" data-testid="select-campaign">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Campaigns</SelectItem>
              <SelectItem value="campaign-1">Campaign 1</SelectItem>
              <SelectItem value="campaign-2">Campaign 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5" data-testid="response-tabs">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Activity className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="responses" data-testid="tab-responses">
            <MessageSquare className="h-4 w-4 mr-2" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="optimization" data-testid="tab-optimization">
            <Lightbulb className="h-4 w-4 mr-2" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="testing" data-testid="tab-testing">
            <Brain className="h-4 w-4 mr-2" />
            Testing
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {loadingDashboard ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading dashboard...
            </div>
          ) : dashboardData?.success && dashboardData?.dashboard ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card data-testid="card-total-responses">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="total-responses-count">
                      {dashboardData?.dashboard?.summary?.totalResponses || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      +12% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-positive-rate">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Positive Rate</CardTitle>
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="positive-rate-value">
                      {((dashboardData?.dashboard?.summary?.positiveResponseRate || 0) * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      +3.2% from last week
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-sentiment">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
                    <Brain className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="avg-sentiment-score">
                      {(dashboardData?.dashboard?.summary?.averageSentimentScore || 0).toFixed(1)}
                    </div>
                    <Progress 
                      value={((dashboardData?.dashboard?.summary?.averageSentimentScore || 0) + 100) / 2} 
                      className="mt-2" 
                    />
                  </CardContent>
                </Card>

                <Card data-testid="card-pending-actions">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
                    <Clock className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600" data-testid="pending-actions-count">
                      {dashboardData?.dashboard?.summary?.pendingActions || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requires attention
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Distribution */}
                <Card data-testid="chart-sentiment-distribution">
                  <CardHeader>
                    <CardTitle>Sentiment Distribution</CardTitle>
                    <CardDescription>Response sentiment breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={dashboardData?.dashboard?.analytics?.sentimentDistribution || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {(dashboardData?.dashboard?.analytics?.sentimentDistribution || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Response Categories */}
                <Card data-testid="chart-response-categories">
                  <CardHeader>
                    <CardTitle>Response Categories</CardTitle>
                    <CardDescription>Response type breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dashboardData?.dashboard?.analytics?.categoryDistribution || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="category" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill={COLORS.primary} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Responses */}
              <Card data-testid="recent-responses-table">
                <CardHeader>
                  <CardTitle>Recent Responses</CardTitle>
                  <CardDescription>Latest detected responses requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(dashboardData?.dashboard?.recentResponses || []).map((item: any, index: number) => (
                      <div key={index} className="flex items-start justify-between p-4 border rounded-lg" data-testid={`response-item-${index}`}>
                        <div className="flex items-start space-x-3">
                          {getResponseTypeIcon(item.response.responseType)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium" data-testid={`response-from-${index}`}>
                                {item.response.responseFrom}
                              </span>
                              {getSentimentIcon(item.analysis?.sentimentCategory)}
                              <Badge 
                                className={getSentimentBadgeColor(item.analysis?.sentimentCategory)}
                                data-testid={`sentiment-badge-${index}`}
                              >
                                {item.analysis?.sentimentCategory}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2" data-testid={`response-text-${index}`}>
                              {item.response.responseText.substring(0, 100)}...
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span data-testid={`response-time-${index}`}>
                                {format(new Date(item.response.responseTime), 'MMM dd, yyyy HH:mm')}
                              </span>
                              <span data-testid={`response-sentiment-score-${index}`}>
                                Score: {item.analysis?.sentimentScore}
                              </span>
                              <span data-testid={`response-actions-count-${index}`}>
                                {item.actionsCount} actions
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {item.analysis?.actionRequired && (
                            <Badge variant="destructive" data-testid={`action-required-${index}`}>
                              Action Required
                            </Badge>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-view-response-${index}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Optimization Insights */}
              {(dashboardData?.dashboard?.insights || []).length > 0 && (
                <Card data-testid="optimization-insights">
                  <CardHeader>
                    <CardTitle>Optimization Insights</CardTitle>
                    <CardDescription>AI-generated recommendations to improve response rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(dashboardData?.dashboard?.insights || []).map((insight: any, index: number) => (
                        <div key={index} className="flex items-start justify-between p-4 border rounded-lg" data-testid={`insight-item-${index}`}>
                          <div className="flex items-start space-x-3">
                            <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium mb-1" data-testid={`insight-title-${index}`}>
                                {insight.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2" data-testid={`insight-description-${index}`}>
                                {insight.description}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <Badge className={getPriorityColor(insight.priority)} data-testid={`insight-priority-${index}`}>
                                  {insight.priority}
                                </Badge>
                                <span data-testid={`insight-impact-${index}`}>
                                  Impact: {insight.estimatedImpact}
                                </span>
                                <span data-testid={`insight-effort-${index}`}>
                                  Effort: {insight.implementationEffort}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-implement-insight-${index}`}
                          >
                            Implement
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Response Data</h3>
              <p className="text-gray-600 dark:text-gray-400">
                No responses have been detected yet. Responses will appear here once detected.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-6">
          <Card data-testid="response-analysis-testing">
            <CardHeader>
              <CardTitle>Response Analysis Testing</CardTitle>
              <CardDescription>
                Test AI-powered sentiment analysis on sample response text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sample-text">Sample Response Text</Label>
                <Textarea
                  id="sample-text"
                  placeholder="Enter a sample response to analyze..."
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={4}
                  data-testid="textarea-sample-text"
                />
              </div>
              <Button 
                onClick={handleAnalyzeSample}
                disabled={analyzeSampleMutation.isPending || !sampleText.trim()}
                data-testid="button-analyze-sample"
              >
                {analyzeSampleMutation.isPending && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Brain className="h-4 w-4 mr-2" />
                Analyze Response
              </Button>

              {analyzeSampleMutation.data && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" data-testid="analysis-results">
                  <h4 className="font-medium mb-3">Analysis Results</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Sentiment Analysis</h5>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {getSentimentIcon(analyzeSampleMutation.data?.sentiment?.category)}
                          <Badge className={getSentimentBadgeColor(analyzeSampleMutation.data?.sentiment?.category)}>
                            {analyzeSampleMutation.data?.sentiment?.category}
                          </Badge>
                          <span className="text-sm" data-testid="sentiment-score">
                            Score: {analyzeSampleMutation.data?.sentiment?.score}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600" data-testid="emotional-tone">
                          Tone: {analyzeSampleMutation.data?.sentiment?.emotionalTone}
                        </div>
                        <div className="text-sm text-gray-600" data-testid="sentiment-confidence">
                          Confidence: {analyzeSampleMutation.data?.sentiment?.confidence}%
                        </div>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm mb-2">Intent Detection</h5>
                      <div className="space-y-2">
                        <Badge variant="outline" data-testid="intent-category">
                          {analyzeSampleMutation.data?.intent?.category}
                        </Badge>
                        <div className="text-sm text-gray-600" data-testid="intent-score">
                          Intent Score: {analyzeSampleMutation.data?.intent?.score}%
                        </div>
                        {(analyzeSampleMutation.data?.intent?.keyIntents || []).length > 0 && (
                          <div className="text-sm" data-testid="key-intents">
                            Key Intents: {(analyzeSampleMutation.data?.intent?.keyIntents || []).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {analyzeSampleMutation.data?.aiSummary && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">AI Summary</h5>
                      <p className="text-sm text-gray-600" data-testid="ai-summary">
                        {analyzeSampleMutation.data.aiSummary}
                      </p>
                    </div>
                  )}
                  
                  {analyzeSampleMutation.data?.nextBestAction && (
                    <div className="mt-3">
                      <h5 className="font-medium text-sm mb-2">Recommended Action</h5>
                      <Badge variant="secondary" data-testid="next-best-action">
                        {analyzeSampleMutation.data.nextBestAction}
                      </Badge>
                    </div>
                  )}

                  {(analyzeSampleMutation.data?.recommendations || []).length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-sm mb-2">AI Recommendations</h5>
                      <ul className="text-sm text-gray-600 space-y-1" data-testid="ai-recommendations">
                        {(analyzeSampleMutation.data?.recommendations || []).map((rec: string, index: number) => (
                          <li key={index}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would be implemented similarly... */}
        <TabsContent value="responses">
          <Card>
            <CardHeader>
              <CardTitle>Response Management</CardTitle>
              <CardDescription>View and manage all detected responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Response Management</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Detailed response management interface coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Response Analytics</CardTitle>
              <CardDescription>Deep dive into response performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Comprehensive analytics dashboard coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization">
          <Card>
            <CardHeader>
              <CardTitle>Response Optimization</CardTitle>
              <CardDescription>Campaign optimization based on response analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Optimization Insights</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  AI-powered optimization recommendations coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}