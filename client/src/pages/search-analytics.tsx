import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart 
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Users, 
  Target, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Filter,
  Activity,
  Eye,
  MousePointer
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SearchAnalyticsDashboardData {
  performance: {
    totalQueries: number;
    averageResponseTime: number;
    totalResults: number;
    clickThroughRate: number;
    qualityScore: number;
    trendData: Array<{
      date: string;
      queries: number;
      responseTime: number;
      quality: number;
    }>;
  };
  quality: {
    averageDataQuality: number;
    verificationRate: number;
    sourcesUsed: string[];
    accuracyScore: number;
    qualityDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  };
  behavior: {
    topSearchTerms: Array<{
      term: string;
      count: number;
      successRate: number;
    }>;
    filterUsage: Array<{
      filter: string;
      usage: number;
      effectiveness: number;
    }>;
    sessionDuration: number;
    averageSearchDepth: number;
    bounceRate: number;
  };
  optimizations: {
    recommendations: Array<{
      id: string;
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      improvementScore: number;
      applied: boolean;
      feedback?: string;
    }>;
    count: number;
  };
  insights: {
    items: Array<{
      id: string;
      type: 'performance' | 'quality' | 'behavior' | 'opportunity';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
      dismissedAt: string | null;
    }>;
    count: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function SearchAnalyticsDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch analytics dashboard data
  const { data: analyticsData, isLoading, error } = useQuery<SearchAnalyticsDashboardData>({
    queryKey: ['/api/search-analytics/dashboard', selectedTimeRange],
    queryFn: async () => {
      const response = await fetch(`/api/search-analytics/dashboard?period=${selectedTimeRange}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json().then(data => data.data);
    },
  });

  // Apply optimization mutation
  const applyOptimizationMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      const response = await fetch(`/api/search-analytics/optimizations/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ feedback }),
      });
      if (!response.ok) throw new Error('Failed to apply optimization');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search-analytics/dashboard'] });
      toast({
        title: "Optimization Applied",
        description: "The search optimization has been applied successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Dismiss insight mutation
  const dismissInsightMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/search-analytics/insights/${id}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to dismiss insight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search-analytics/dashboard'] });
      toast({
        title: "Insight Dismissed",
        description: "The insight has been dismissed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load search analytics data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const performance = analyticsData?.performance || {};
  const quality = analyticsData?.quality || {};
  const behavior = analyticsData?.behavior || {};
  const optimizations = analyticsData?.optimizations || { recommendations: [], count: 0 };
  const insights = analyticsData?.insights || { items: [], count: 0 };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8" data-testid="search-analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
            Search Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor your search performance, quality metrics, and optimization opportunities
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
            data-testid="time-range-selector"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="metric-total-queries">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.totalQueries?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {selectedTimeRange === '1d' ? '24 hours' : selectedTimeRange === '7d' ? '7 days' : selectedTimeRange === '30d' ? '30 days' : '90 days'}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.averageResponseTime || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Search performance metric
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-quality-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(performance.qualityScore || 0)}%</div>
            <p className="text-xs text-muted-foreground">
              Data quality average
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-click-through-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(performance.clickThroughRate || 0)}%</div>
            <p className="text-xs text-muted-foreground">
              Result engagement rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="analytics-tabs">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response Time Trend */}
            <Card data-testid="performance-trend-chart">
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Search performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performance.trendData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Response Time (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Query Volume */}
            <Card data-testid="query-volume-chart">
              <CardHeader>
                <CardTitle>Search Volume</CardTitle>
                <CardDescription>Number of searches over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performance.trendData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="queries" 
                      stroke="#82ca9d" 
                      fill="#82ca9d"
                      fillOpacity={0.6}
                      name="Queries"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Distribution */}
            <Card data-testid="quality-distribution-chart">
              <CardHeader>
                <CardTitle>Data Quality Distribution</CardTitle>
                <CardDescription>Quality score ranges across search results</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={quality.qualityDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ range, percentage }) => `${range}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(quality.qualityDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quality Metrics */}
            <Card data-testid="quality-metrics">
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
                <CardDescription>Key quality indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Average Data Quality</span>
                  <Badge variant="outline">
                    {Math.round(quality.averageDataQuality || 0)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Verification Rate</span>
                  <Badge variant="outline">
                    {Math.round(quality.verificationRate || 0)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Accuracy Score</span>
                  <Badge variant="outline">
                    {Math.round(quality.accuracyScore || 0)}%
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Data Sources Used</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(quality.sourcesUsed || []).map((source, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Search Terms */}
            <Card data-testid="top-search-terms">
              <CardHeader>
                <CardTitle>Top Search Terms</CardTitle>
                <CardDescription>Most frequently searched keywords</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(behavior.topSearchTerms || []).slice(0, 10).map((term, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium">{term.term}</div>
                        <div className="text-xs text-muted-foreground">
                          {term.count} searches • {Math.round(term.successRate)}% success rate
                        </div>
                      </div>
                      <Badge variant="outline">{term.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Filter Usage */}
            <Card data-testid="filter-usage-chart">
              <CardHeader>
                <CardTitle>Filter Usage & Effectiveness</CardTitle>
                <CardDescription>How filters are being used and their impact</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={behavior.filterUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="filter" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="usage" fill="#8884d8" name="Usage Count" />
                    <Bar dataKey="effectiveness" fill="#82ca9d" name="Effectiveness %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Behavior Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="session-duration">
              <CardHeader>
                <CardTitle>Avg Session Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((behavior.sessionDuration || 0) / 60)}m
                </div>
                <p className="text-xs text-muted-foreground">Time spent searching</p>
              </CardContent>
            </Card>

            <Card data-testid="search-depth">
              <CardHeader>
                <CardTitle>Avg Search Depth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(behavior.averageSearchDepth || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Searches per session</p>
              </CardContent>
            </Card>

            <Card data-testid="bounce-rate">
              <CardHeader>
                <CardTitle>Bounce Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(behavior.bounceRate || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">Single-search sessions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Optimizations Tab */}
        <TabsContent value="optimizations" className="space-y-6">
          {/* Optimization Recommendations */}
          <Card data-testid="optimization-recommendations">
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>
                {optimizations.count} recommendations to improve your search performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optimizations.recommendations.map((rec) => (
                  <div key={rec.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{rec.title}</h4>
                          <Badge 
                            variant={rec.impact === 'high' ? 'destructive' : rec.impact === 'medium' ? 'default' : 'secondary'}
                          >
                            {rec.impact} impact
                          </Badge>
                          {rec.applied && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Applied
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rec.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Potential improvement: +{rec.improvementScore}% performance
                        </div>
                        {rec.feedback && (
                          <div className="mt-2 text-xs bg-muted p-2 rounded">
                            Feedback: {rec.feedback}
                          </div>
                        )}
                      </div>
                      {!rec.applied && (
                        <Button
                          size="sm"
                          onClick={() => applyOptimizationMutation.mutate({ id: rec.id })}
                          disabled={applyOptimizationMutation.isPending}
                          data-testid={`apply-optimization-${rec.id}`}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {optimizations.recommendations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2" />
                    <p>No optimization recommendations at this time.</p>
                    <p className="text-sm">Your search performance is looking great!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search Insights */}
          <Card data-testid="search-insights">
            <CardHeader>
              <CardTitle>Search Insights</CardTitle>
              <CardDescription>
                {insights.count} actionable insights about your search patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.items.filter(insight => !insight.dismissedAt).map((insight) => (
                  <Alert key={insight.id}>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start gap-3">
                        {insight.type === 'performance' && <Activity className="h-4 w-4 mt-0.5" />}
                        {insight.type === 'quality' && <Target className="h-4 w-4 mt-0.5" />}
                        {insight.type === 'behavior' && <Users className="h-4 w-4 mt-0.5" />}
                        {insight.type === 'opportunity' && <TrendingUp className="h-4 w-4 mt-0.5" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTitle className="text-sm">{insight.title}</AlertTitle>
                            <Badge 
                              variant={insight.priority === 'high' ? 'destructive' : insight.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {insight.priority}
                            </Badge>
                          </div>
                          <AlertDescription className="text-sm">
                            {insight.description}
                          </AlertDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissInsightMutation.mutate(insight.id)}
                        disabled={dismissInsightMutation.isPending}
                        data-testid={`dismiss-insight-${insight.id}`}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </Alert>
                ))}

                {insights.items.filter(insight => !insight.dismissedAt).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="w-8 h-8 mx-auto mb-2" />
                    <p>No new insights available.</p>
                    <p className="text-sm">We'll notify you when new patterns are detected.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}