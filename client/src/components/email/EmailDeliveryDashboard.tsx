import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Mail, 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  Settings,
  BarChart3,
  Zap,
  Globe,
  Lock,
  Eye,
  AlertCircle
} from "lucide-react";

interface EmailDeliveryDashboardProps {
  userId?: string;
}

export default function EmailDeliveryDashboard({ userId }: EmailDeliveryDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [domainConfig, setDomainConfig] = useState({
    customDomain: "",
    spf: true,
    dkim: true,
    dmarc: true
  });

  const effectiveUserId = userId || user?.id;

  // Fetch delivery metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/email-delivery/metrics", effectiveUserId, selectedCampaign],
    enabled: !!effectiveUserId,
    retry: false,
  });

  // Fetch health report
  const { data: healthReport, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/email-delivery/health-report", effectiveUserId],
    enabled: !!effectiveUserId,
    retry: false,
  });

  // Initialize email delivery system
  const initializeSystem = useMutation({
    mutationFn: async (config: any) => {
      const response = await apiRequest("POST", "/api/email-delivery/initialize", config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Delivery System Initialized",
        description: "Advanced delivery optimization has been activated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-delivery"] });
    },
    onError: (error) => {
      toast({
        title: "Initialization Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'good': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const handleInitializeSystem = async () => {
    const config = {
      domainAuthentication: domainConfig,
      deliverabilitySettings: {
        reputationProtection: true,
        bounceHandling: true,
        complaintHandling: true,
        suppressionLists: true,
        emailThrottling: true,
      },
      performanceTargets: {
        deliveryRate: 0.95,
        inboxPlacement: 0.90,
        bounceRate: 0.02,
        complaintRate: 0.001,
      }
    };

    await initializeSystem.mutateAsync(config);
  };

  if (metricsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading email delivery dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-delivery-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Delivery System</h2>
          <p className="text-gray-600">Advanced deliverability optimization and monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleInitializeSystem}
            disabled={initializeSystem.isPending}
            data-testid="button-initialize"
          >
            <Zap className="w-4 h-4 mr-2" />
            {initializeSystem.isPending ? "Initializing..." : "Initialize System"}
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      {healthReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {getHealthIcon(healthReport.overallHealth)}
              <span className="ml-2">Delivery Health Status</span>
              <Badge 
                variant={healthReport.overallHealth === 'excellent' || healthReport.overallHealth === 'good' ? 'default' : 'destructive'}
                className="ml-2"
              >
                {healthReport.overallHealth.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>
              Overall score: {healthReport.score}/100 - {healthReport.overallHealth} performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Health Score</span>
                  <span>{healthReport.score}/100</span>
                </div>
                <Progress value={healthReport.score} className="h-2" />
              </div>

              {healthReport.issues.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{healthReport.issues.length} issues detected:</strong>
                    <ul className="mt-2 space-y-1">
                      {healthReport.issues.slice(0, 3).map((issue: any, index: number) => (
                        <li key={index} className="text-sm">
                          • {issue.description}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Delivery Metrics</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Delivery Rate</p>
                    <p className="text-2xl font-bold" data-testid="metric-delivery-rate">
                      {metrics?.deliveryRate ? `${metrics.deliveryRate.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Inbox Placement</p>
                    <p className="text-2xl font-bold" data-testid="metric-inbox-placement">
                      {metrics?.inboxPlacement ? `${metrics.inboxPlacement.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Bounce Rate</p>
                    <p className="text-2xl font-bold" data-testid="metric-bounce-rate">
                      {metrics?.bounceRate ? `${metrics.bounceRate.toFixed(2)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Reputation Score</p>
                    <p className="text-2xl font-bold" data-testid="metric-reputation-score">
                      {metrics?.reputationScore ? Math.round(metrics.reputationScore) : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Sent:</span>
                  <span className="ml-2 font-medium" data-testid="metric-total-sent">{metrics?.totalSent || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Delivered:</span>
                  <span className="ml-2 font-medium" data-testid="metric-delivered">{metrics?.delivered || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Opened:</span>
                  <span className="ml-2 font-medium" data-testid="metric-opened">{metrics?.opened || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Clicked:</span>
                  <span className="ml-2 font-medium" data-testid="metric-clicked">{metrics?.clicked || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Bounced:</span>
                  <span className="ml-2 font-medium" data-testid="metric-bounced">{metrics?.bounced || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Complained:</span>
                  <span className="ml-2 font-medium" data-testid="metric-complained">{metrics?.complained || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Blocked:</span>
                  <span className="ml-2 font-medium" data-testid="metric-blocked">{metrics?.blocked || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Unsubscribed:</span>
                  <span className="ml-2 font-medium" data-testid="metric-unsubscribed">{metrics?.unsubscribed || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Domain Authentication Setup
              </CardTitle>
              <CardDescription>
                Configure SPF, DKIM, and DMARC for maximum deliverability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-domain">Custom Domain</Label>
                  <Input
                    id="custom-domain"
                    placeholder="yourdomain.com"
                    value={domainConfig.customDomain}
                    onChange={(e) => setDomainConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                    data-testid="input-custom-domain"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>SPF Record</Label>
                      <p className="text-sm text-gray-600">Sender Policy Framework authentication</p>
                    </div>
                    <Switch
                      checked={domainConfig.spf}
                      onCheckedChange={(checked) => setDomainConfig(prev => ({ ...prev, spf: checked }))}
                      data-testid="switch-spf"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>DKIM Signatures</Label>
                      <p className="text-sm text-gray-600">DomainKeys Identified Mail signing</p>
                    </div>
                    <Switch
                      checked={domainConfig.dkim}
                      onCheckedChange={(checked) => setDomainConfig(prev => ({ ...prev, dkim: checked }))}
                      data-testid="switch-dkim"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>DMARC Policy</Label>
                      <p className="text-sm text-gray-600">Domain Message Authentication Reporting</p>
                    </div>
                    <Switch
                      checked={domainConfig.dmarc}
                      onCheckedChange={(checked) => setDomainConfig(prev => ({ ...prev, dmarc: checked }))}
                      data-testid="switch-dmarc"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4" />
                    <span>SPF Record</span>
                  </div>
                  <Badge variant="secondary">Not Configured</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-4 h-4" />
                    <span>DKIM Signatures</span>
                  </div>
                  <Badge variant="secondary">Not Configured</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-4 h-4" />
                    <span>DMARC Policy</span>
                  </div>
                  <Badge variant="secondary">Not Configured</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Deliverability Optimization
              </CardTitle>
              <CardDescription>
                Advanced settings to maximize email delivery success
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Reputation Protection</h4>
                    <p className="text-sm text-gray-600">Automatic sender reputation monitoring and protection</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-reputation-protection" />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Bounce Handling</h4>
                    <p className="text-sm text-gray-600">Automatic bounce processing and suppression list management</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-bounce-handling" />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Complaint Handling</h4>
                    <p className="text-sm text-gray-600">Process spam complaints and feedback loops</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-complaint-handling" />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Content Optimization</h4>
                    <p className="text-sm text-gray-600">AI-powered content analysis for better deliverability</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-content-optimization" />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Send Time Optimization</h4>
                    <p className="text-sm text-gray-600">Smart timing based on recipient behavior patterns</p>
                  </div>
                  <Switch data-testid="switch-send-time-optimization" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Delivery Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthReport?.recommendations && healthReport.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Optimization Recommendations</h4>
                  {healthReport.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">{rec}</p>
                    </div>
                  ))}
                </div>
              )}

              {(!healthReport?.recommendations || healthReport.recommendations.length === 0) && (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No recommendations available yet.</p>
                  <p className="text-sm text-gray-500">Send more emails to get personalized insights.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}