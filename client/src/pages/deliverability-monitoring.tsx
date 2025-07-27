import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  RefreshCw,
  Activity,
  Eye,
  MousePointer,
  Ban,
  MessageSquare,
  Settings,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DeliverabilityDashboard {
  overview: {
    reputationScore: number;
    reputationStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    deliveryRate: number;
    bounceRate: number;
    spamRate: number;
    openRate: number;
    lastUpdated: string | null;
  };
  alerts: {
    total: number;
    emergency: number;
    critical: number;
    warning: number;
    recent: Array<{
      id: string;
      alertTitle: string;
      alertMessage: string;
      alertSeverity: string;
      triggeredAt: string;
    }>;
  };
  blacklist: {
    totalMonitored: number;
    activeListings: number;
    cleanTargets: number;
    criticalIssues: number;
  };
  optimizations: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    highPriority: number;
  };
  trends: {
    recentReports: Array<{
      id: string;
      reportPeriod: string;
      deliveryRate: number;
      bounceRate: number;
      spamRate: number;
      openRate: number;
      reputationScore: number;
      createdAt: string;
    }>;
    reputationTrend: Array<{
      date: string;
      score: number;
      deliveryRate: number;
    }>;
  };
}

interface DeliverabilityAlert {
  id: string;
  alertType: string;
  alertSeverity: 'emergency' | 'critical' | 'warning' | 'info';
  alertTitle: string;
  alertMessage: string;
  triggeredAt: string;
  recommendations: string[];
}

interface BlacklistResult {
  blacklistName: string;
  isListed: boolean;
  severityLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'clean' | 'listed' | 'delisting_requested' | 'resolved';
  listingReason?: string;
}

interface OptimizationRecommendation {
  id: string;
  optimizationType: string;
  optimizationTitle: string;
  optimizationDescription: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: 'low' | 'medium' | 'high';
  implementationDifficulty: 'easy' | 'medium' | 'hard';
  recommendedActions: string[];
  status: 'pending' | 'in_progress' | 'implemented' | 'testing' | 'completed' | 'cancelled';
  implementationProgress?: number;
}

export default function DeliverabilityMonitoringPage() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [blacklistTarget, setBlacklistTarget] = useState('');
  const [blacklistType, setBlacklistType] = useState<'domain' | 'ip' | 'subdomain'>('domain');

  // Fetch dashboard data
  const { data: dashboard, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery<DeliverabilityDashboard>({
    queryKey: ['/api/deliverability/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch alerts
  const { data: alertsData, isLoading: isAlertsLoading } = useQuery<{data: DeliverabilityAlert[]}>({
    queryKey: ['/api/deliverability/alerts'],
    refetchInterval: 10000, // Refresh every 10 seconds for alerts
  });

  // Fetch optimization recommendations
  const { data: optimizationsData, isLoading: isOptimizationsLoading } = useQuery<{data: OptimizationRecommendation[]}>({
    queryKey: ['/api/deliverability/optimizations'],
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportPeriod: 'daily' | 'weekly' | 'monthly') => {
      return await apiRequest('/api/deliverability/reports/generate', 'POST', { reportPeriod });
    },
    onSuccess: () => {
      toast({
        title: "Report Generated",
        description: "New deliverability report has been generated successfully.",
      });
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  // Blacklist check mutation
  const blacklistCheckMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/deliverability/blacklist/check', 'POST', {
        targetValue: blacklistTarget,
        monitoringType: blacklistType
      });
    },
    onSuccess: (data: {data: BlacklistResult[], summary: any}) => {
      const listingsFound = data.summary.listingsFound;
      toast({
        title: listingsFound === 0 ? "All Clear" : "Blacklist Detected",
        description: listingsFound === 0 ? 
          "No blacklist listings found" : 
          `Found ${listingsFound} blacklist listings`,
        variant: listingsFound === 0 ? "default" : "destructive",
      });
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to check blacklist",
        variant: "destructive",
      });
    },
  });

  // Generate optimization recommendations mutation
  const optimizeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/deliverability/optimize', 'POST', {});
    },
    onSuccess: (data: {total: number}) => {
      toast({
        title: "Optimizations Generated",
        description: `Generated ${data.total} optimization recommendations`,
      });
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate optimizations",
        variant: "destructive",
      });
    },
  });

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiRequest('/api/deliverability/alerts/acknowledge', 'POST', { alertId });
    },
    onSuccess: () => {
      toast({
        title: "Alert Acknowledged",
        description: "Alert has been acknowledged successfully.",
      });
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge alert",
        variant: "destructive",
      });
    },
  });

  const getReputationColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency': return 'text-red-600 bg-red-50 border-red-200';
      case 'critical': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading deliverability dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="deliverability-monitoring-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Deliverability Monitoring</h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Monitor email reputation, blacklist status, and deliverability metrics
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => generateReportMutation.mutate(selectedPeriod)}
            disabled={generateReportMutation.isPending}
            data-testid="button-generate-report"
          >
            {generateReportMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
          <Button 
            onClick={() => refetchDashboard()}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-reputation-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reputation Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-reputation-score">
              {dashboard?.overview.reputationScore || 0}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge 
                className={getReputationColor(dashboard?.overview.reputationStatus || 'unknown')}
                data-testid={`badge-reputation-${dashboard?.overview.reputationStatus}`}
              >
                {dashboard?.overview.reputationStatus?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
            <Progress 
              value={dashboard?.overview.reputationScore || 0} 
              className="mt-2" 
              data-testid="progress-reputation"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-delivery-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-delivery-rate">
              {dashboard?.overview.deliveryRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Industry standard: 95%+
            </p>
            <Progress 
              value={dashboard?.overview.deliveryRate || 0} 
              className="mt-2" 
              data-testid="progress-delivery"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-bounce-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-bounce-rate">
              {dashboard?.overview.bounceRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Target: &lt;5%
            </p>
            <Progress 
              value={dashboard?.overview.bounceRate || 0} 
              className="mt-2" 
              data-testid="progress-bounce"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-open-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-rate">
              {dashboard?.overview.openRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Industry average: 25%
            </p>
            <Progress 
              value={dashboard?.overview.openRate || 0} 
              className="mt-2" 
              data-testid="progress-open"
            />
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {dashboard?.alerts && dashboard.alerts.total > 0 && (
        <Card data-testid="card-active-alerts">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Active Alerts ({dashboard.alerts.total})
            </CardTitle>
            <CardDescription>
              Critical deliverability issues requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.alerts.recent.map((alert) => (
              <Alert 
                key={alert.id} 
                className={getSeverityColor(alert.alertSeverity)}
                data-testid={`alert-${alert.id}`}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.alertTitle}</AlertTitle>
                <AlertDescription className="mt-2">
                  {alert.alertMessage}
                  <div className="mt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                      disabled={acknowledgeAlertMutation.isPending}
                      data-testid={`button-acknowledge-${alert.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Acknowledge
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="blacklist" className="space-y-4">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="blacklist" data-testid="tab-blacklist">Blacklist Monitoring</TabsTrigger>
          <TabsTrigger value="optimizations" data-testid="tab-optimizations">Optimizations</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends & Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="blacklist" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Blacklist Check Form */}
            <Card data-testid="card-blacklist-check">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Blacklist Check
                </CardTitle>
                <CardDescription>
                  Check your domain or IP against major blacklists
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Target</label>
                  <input
                    type="text"
                    value={blacklistTarget}
                    onChange={(e) => setBlacklistTarget(e.target.value)}
                    placeholder="Enter domain or IP"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    data-testid="input-blacklist-target"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={blacklistType}
                    onChange={(e) => setBlacklistType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    data-testid="select-blacklist-type"
                  >
                    <option value="domain">Domain</option>
                    <option value="ip">IP Address</option>
                    <option value="subdomain">Subdomain</option>
                  </select>
                </div>
                <Button 
                  onClick={() => blacklistCheckMutation.mutate()}
                  disabled={blacklistCheckMutation.isPending || !blacklistTarget}
                  className="w-full"
                  data-testid="button-check-blacklist"
                >
                  {blacklistCheckMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Check Blacklists
                </Button>
              </CardContent>
            </Card>

            {/* Blacklist Status */}
            <Card className="lg:col-span-2" data-testid="card-blacklist-status">
              <CardHeader>
                <CardTitle>Blacklist Status Overview</CardTitle>
                <CardDescription>
                  Current blacklist monitoring status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600" data-testid="text-clean-targets">
                      {dashboard?.blacklist.cleanTargets || 0}
                    </div>
                    <div className="text-sm text-green-700">Clean Targets</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600" data-testid="text-active-listings">
                      {dashboard?.blacklist.activeListings || 0}
                    </div>
                    <div className="text-sm text-red-700">Active Listings</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600" data-testid="text-total-monitored">
                      {dashboard?.blacklist.totalMonitored || 0}
                    </div>
                    <div className="text-sm text-blue-700">Total Monitored</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600" data-testid="text-critical-issues">
                      {dashboard?.blacklist.criticalIssues || 0}
                    </div>
                    <div className="text-sm text-orange-700">Critical Issues</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
              <p className="text-muted-foreground">AI-powered suggestions to improve deliverability</p>
            </div>
            <Button 
              onClick={() => optimizeMutation.mutate()}
              disabled={optimizeMutation.isPending}
              data-testid="button-generate-optimizations"
            >
              {optimizeMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Recommendations
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {optimizationsData?.data?.map((optimization) => (
              <Card key={optimization.id} data-testid={`optimization-${optimization.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm">{optimization.optimizationTitle}</CardTitle>
                    <Badge 
                      className={getPriorityColor(optimization.priority)}
                      data-testid={`badge-priority-${optimization.priority}`}
                    >
                      {optimization.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription>{optimization.optimizationType}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {optimization.optimizationDescription}
                  </p>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Impact: {optimization.estimatedImpact}</span>
                    <span>Difficulty: {optimization.implementationDifficulty}</span>
                  </div>

                  {optimization.implementationProgress !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{optimization.implementationProgress}%</span>
                      </div>
                      <Progress 
                        value={optimization.implementationProgress} 
                        data-testid={`progress-optimization-${optimization.id}`}
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <Badge 
                      variant="outline"
                      data-testid={`badge-status-${optimization.status}`}
                    >
                      {optimization.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!optimizationsData?.data || optimizationsData.data.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No optimization recommendations available.</p>
              <p className="text-sm">Click "Generate Recommendations" to get AI-powered suggestions.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card data-testid="card-recent-reports">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Recent Reports
              </CardTitle>
              <CardDescription>
                Historical deliverability performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.trends.recentReports?.length ? (
                <div className="space-y-4">
                  {dashboard.trends.recentReports.map((report) => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`report-${report.id}`}
                    >
                      <div>
                        <div className="font-medium capitalize">{report.reportPeriod} Report</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex space-x-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Delivery</div>
                          <div className="font-medium">{report.deliveryRate}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Open</div>
                          <div className="font-medium">{report.openRate}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Reputation</div>
                          <div className="font-medium">{report.reputationScore}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reports available yet.</p>
                  <p className="text-sm">Generate your first report to see trends.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}