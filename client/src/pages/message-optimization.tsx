import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  MessageSquare, 
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  PlusCircle,
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ABTest {
  id: string;
  testName: string;
  testType: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  hypothesis: string;
  startedAt: string | null;
  completedAt: string | null;
  sampleSize: number;
  confidenceLevel: number;
  currentSampleSize: number;
  variants: MessageVariant[];
  results?: {
    winningVariant: string;
    improvementPercent: number;
    significance: number;
  };
}

interface MessageVariant {
  id: string;
  variantName: string;
  variantType: 'control' | 'treatment';
  conversions: number;
  totalSent: number;
  conversionRate: number;
  changes: Record<string, any>;
}

interface EffectivenessScore {
  messageId: string;
  overallScore: number;
  engagementScore: number;
  conversionScore: number;
  qualityScore: number;
  relevanceScore: number;
  subjectLineScore: number;
  contentScore: number;
  ctaScore: number;
  personalizationScore: number;
  timingScore: number;
  insights: Record<string, any>;
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
  confidence: number;
}

export default function MessageOptimization() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  // Fetch optimization dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/message-optimization/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create A/B test mutation
  const createTestMutation = useMutation({
    mutationFn: async (testData: any) => {
      return apiRequest('/api/message-optimization/ab-tests', 'POST', testData);
    },
    onSuccess: () => {
      toast({
        title: 'A/B Test Created',
        description: 'Your A/B test has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/message-optimization/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create A/B test',
        variant: 'destructive',
      });
    },
  });

  // Start A/B test mutation
  const startTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest(`/api/message-optimization/ab-tests/${testId}/start`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: 'A/B Test Started',
        description: 'Your A/B test is now running.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/message-optimization/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start A/B test',
        variant: 'destructive',
      });
    },
  });

  const handleCreateTest = () => {
    const testData = {
      testName: 'Subject Line Test - ' + new Date().toLocaleDateString(),
      testType: 'subject_line',
      hypothesis: 'A more personalized subject line will increase open rates',
      testDescription: 'Testing personalized vs generic subject lines',
      sampleSize: 100,
      confidenceLevel: 95,
      minDetectableEffect: 5,
      trafficSplit: { A: 50, B: 50 },
      plannedDuration: 24,
    };

    createTestMutation.mutate(testData);
  };

  const handleStartTest = (testId: string) => {
    startTestMutation.mutate(testId);
  };

  if (dashboardLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = (dashboard as any)?.stats || {};
  const activeTests = (dashboard as any)?.activeTests || [];
  const recentResults = (dashboard as any)?.recentResults || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="message-optimization-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Message Optimization</h1>
          <p className="text-gray-600 mt-1">AI-powered A/B testing and message effectiveness analysis</p>
        </div>
        <Button 
          onClick={handleCreateTest} 
          disabled={createTestMutation.isPending}
          data-testid="button-create-test"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create A/B Test
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="metric-active-tests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-tests">
              {stats.activeTests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +{stats.testsThisWeek || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-avg-improvement">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-avg-improvement">
              +{stats.avgImprovement || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              From completed tests
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-messages-tested">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Tested</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-messages-tested">
              {stats.messagesTested || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-conversion-uplift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Uplift</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-conversion-uplift">
              +{stats.conversionUplift || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall improvement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="optimization-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="active-tests" data-testid="tab-active-tests">Active Tests</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="effectiveness" data-testid="tab-effectiveness">Effectiveness Scoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Trends Chart */}
            <Card data-testid="performance-trends-chart">
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  Message performance improvements over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.performanceTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="conversionRate" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Conversion Rate %" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="openRate" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Open Rate %" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Test Type Performance */}
            <Card data-testid="test-type-performance">
              <CardHeader>
                <CardTitle>Test Type Performance</CardTitle>
                <CardDescription>
                  Which optimizations work best
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.testTypePerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="testType" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgImprovement" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Optimizations */}
          <Card data-testid="recent-optimizations">
            <CardHeader>
              <CardTitle>Recent Optimization Insights</CardTitle>
              <CardDescription>
                AI-powered recommendations from your latest tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentInsights?.map((insight: any, index: number) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">{insight.title}</p>
                      <p className="text-sm text-blue-700">{insight.description}</p>
                      <Badge variant="secondary" className="mt-1">
                        +{insight.expectedImprovement}% improvement
                      </Badge>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No optimization insights available yet. Create your first A/B test to get started!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-tests" className="space-y-4">
          <div className="grid gap-4">
            {activeTests.map((test: ABTest) => (
              <Card key={test.id} data-testid={`active-test-${test.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {test.testName}
                        <Badge 
                          variant={test.status === 'running' ? 'default' : 'secondary'}
                          data-testid={`test-status-${test.id}`}
                        >
                          {test.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{test.hypothesis}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {test.status === 'draft' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleStartTest(test.id)}
                          disabled={startTestMutation.isPending}
                          data-testid={`button-start-test-${test.id}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      <Button size="sm" variant="outline" data-testid={`button-more-${test.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Sample Progress</span>
                        <span data-testid={`test-progress-${test.id}`}>
                          {test.currentSampleSize} / {test.sampleSize}
                        </span>
                      </div>
                      <Progress 
                        value={(test.currentSampleSize / test.sampleSize) * 100} 
                        className="h-2"
                        data-testid={`progress-bar-${test.id}`}
                      />
                    </div>

                    {/* Variants Performance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {test.variants.map((variant: MessageVariant) => (
                        <div key={variant.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{variant.variantName}</span>
                            <Badge variant={variant.variantType === 'control' ? 'outline' : 'default'}>
                              {variant.variantType}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Conversion Rate:</span>
                              <span className="font-medium" data-testid={`variant-conversion-${variant.id}`}>
                                {variant.conversionRate.toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Sent:</span>
                              <span data-testid={`variant-sent-${variant.id}`}>
                                {variant.totalSent}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Conversions:</span>
                              <span data-testid={`variant-conversions-${variant.id}`}>
                                {variant.conversions}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {activeTests.length === 0 && (
              <Card data-testid="no-active-tests">
                <CardContent className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Tests</h3>
                  <p className="text-gray-500 mb-4">
                    Create your first A/B test to start optimizing your messages
                  </p>
                  <Button onClick={handleCreateTest} data-testid="button-create-first-test">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Your First Test
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <div className="grid gap-4">
            {recentResults.map((result: any, index: number) => (
              <Card key={index} data-testid={`test-result-${index}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {result.testName}
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Completed on {new Date(result.completedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600" data-testid={`result-improvement-${index}`}>
                        +{result.improvementPercent}%
                      </div>
                      <p className="text-sm text-gray-500">improvement</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">Winning Variant</p>
                        <p className="text-sm text-green-700">{result.winningVariant}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-600">Confidence Level</p>
                        <p className="font-bold text-green-900" data-testid={`result-confidence-${index}`}>
                          {result.significance}%
                        </p>
                      </div>
                    </div>
                    
                    {result.insights && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Key Insights:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                          {result.insights.map((insight: string, i: number) => (
                            <li key={i}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {recentResults.length === 0 && (
              <Card data-testid="no-results">
                <CardContent className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                  <p className="text-gray-500">
                    Complete your first A/B test to see results here
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="effectiveness" className="space-y-4">
          <Card data-testid="effectiveness-scoring">
            <CardHeader>
              <CardTitle>Message Effectiveness Scoring</CardTitle>
              <CardDescription>
                AI-powered analysis of your message effectiveness across multiple dimensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Effectiveness Scoring</h3>
                <p className="text-gray-500 mb-4">
                  Select messages from your campaigns to analyze their effectiveness
                </p>
                <Button variant="outline" data-testid="button-analyze-messages">
                  Analyze Messages
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}