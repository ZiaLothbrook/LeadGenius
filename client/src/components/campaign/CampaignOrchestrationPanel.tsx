import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Play, 
  Pause, 
  Settings, 
  BarChart3, 
  Clock, 
  Mail, 
  MessageSquare, 
  Phone, 
  Smartphone,
  Target,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface SequenceStep {
  id: string;
  stepNumber: number;
  channel: 'email' | 'linkedin' | 'sms' | 'phone';
  delayDays: number;
  messageTemplate: string;
  subject?: string;
  isActive: boolean;
}

interface CampaignOrchestrationPanelProps {
  campaignId: string;
  onClose?: () => void;
}

export default function CampaignOrchestrationPanel({ campaignId, onClose }: CampaignOrchestrationPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customSequence, setCustomSequence] = useState<Partial<SequenceStep>[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sequence templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/sequence-templates"],
    retry: false,
  });

  // Fetch campaign performance
  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "performance"],
    retry: false,
  });

  // Fetch sequence analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "sequence", "analytics"],
    retry: false,
  });

  // Initialize orchestration mutation
  const initializeOrchestration = useMutation({
    mutationFn: async (config: any) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/orchestration/initialize`, config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign Orchestration Initialized",
        description: "Multi-channel sequence has been activated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: (error) => {
      toast({
        title: "Initialization Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Apply template mutation
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/sequence/apply-template`, {
        templateId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Applied",
        description: "Sequence template has been applied to your campaign.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: (error) => {
      toast({
        title: "Template Application Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Optimize campaign mutation
  const optimizeCampaign = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/optimize`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campaign Optimized",
        description: `Applied ${data.optimizationsApplied.length} optimizations. Expected ${Math.round(data.expectedImprovement * 100)}% improvement.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: (error) => {
      toast({
        title: "Optimization Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'linkedin': return <MessageSquare className="w-4 h-4" />;
      case 'sms': return <Smartphone className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email': return 'bg-blue-100 text-blue-800';
      case 'linkedin': return 'bg-indigo-100 text-indigo-800';
      case 'sms': return 'bg-green-100 text-green-800';
      case 'phone': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No Template Selected",
        description: "Please select a sequence template to apply.",
        variant: "destructive",
      });
      return;
    }

    await applyTemplate.mutateAsync(selectedTemplate);
  };

  if (templatesLoading || performanceLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaign orchestration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="campaign-orchestration-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campaign Orchestration</h2>
          <p className="text-gray-600">Multi-channel sequence management and optimization</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => optimizeCampaign.mutate()}
            disabled={optimizeCampaign.isPending}
            data-testid="button-optimize"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {optimizeCampaign.isPending ? "Optimizing..." : "Auto-Optimize"}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} data-testid="button-close">
              Close
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Prospects</p>
                    <p className="text-2xl font-bold" data-testid="metric-total-prospects">
                      {performance?.totalProspects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Play className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl font-bold" data-testid="metric-active-prospects">
                      {performance?.activeProspects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold" data-testid="metric-completed-prospects">
                      {performance?.completedProspects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Response Rate</p>
                    <p className="text-2xl font-bold" data-testid="metric-response-rate">
                      {performance?.overallMetrics?.responseRate ? `${Math.round(performance.overallMetrics.responseRate * 100)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Channel Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance?.channelPerformance && Object.entries(performance.channelPerformance).map(([channel, metrics]) => (
                  <div key={channel} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge className={getChannelColor(channel)}>
                        {getChannelIcon(channel)}
                        <span className="ml-1 capitalize">{channel}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div>
                        <span className="text-gray-600">Sent:</span>
                        <span className="ml-1 font-medium" data-testid={`metric-${channel}-sent`}>{metrics.sent}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Opened:</span>
                        <span className="ml-1 font-medium" data-testid={`metric-${channel}-opened`}>{metrics.opened}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Replied:</span>
                        <span className="ml-1 font-medium" data-testid={`metric-${channel}-replied`}>{metrics.replied}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Rate:</span>
                        <span className="ml-1 font-medium" data-testid={`metric-${channel}-rate`}>
                          {Math.round(metrics.conversionRate * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequence Tab */}
        <TabsContent value="sequence" className="space-y-4">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Templates</CardTitle>
              <CardDescription>Choose a proven sequence template or create a custom sequence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates?.map((template: any) => (
                  <div
                    key={template.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{template.name}</h3>
                      <Badge variant="secondary">{template.steps.length} steps</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.estimatedDuration} days</span>
                      <span>{template.expectedResponseRate}% response rate</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplate || applyTemplate.isPending}
                  data-testid="button-apply-template"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {applyTemplate.isPending ? "Applying..." : "Apply Template"}
                </Button>
                <Button variant="outline" onClick={() => setIsConfiguring(!isConfiguring)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Custom Sequence
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sequence Visualization */}
          {analytics?.stepPerformance && (
            <Card>
              <CardHeader>
                <CardTitle>Current Sequence</CardTitle>
                <CardDescription>Track prospect progress through your sequence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.stepPerformance.map((step: any, index: number) => (
                    <div key={step.stepId} className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                        {step.stepNumber}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <Badge className={getChannelColor(step.channel)}>
                              {getChannelIcon(step.channel)}
                              <span className="ml-1 capitalize">{step.channel}</span>
                            </Badge>
                            <span className="text-sm font-medium">Step {step.stepNumber}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {step.sent} sent • {Math.round(step.conversionRate * 100)}% converted
                          </div>
                        </div>
                        <Progress value={step.conversionRate * 100} className="h-2" />
                      </div>
                      {index < analytics.stepPerformance.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {analyticsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overall Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Sequence Completion</p>
                      <p className="text-xl font-bold">
                        {analytics?.overallMetrics?.avgStepsCompleted || 0} / {analytics?.stepPerformance?.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversion Rate</p>
                      <p className="text-xl font-bold">
                        {analytics?.overallMetrics?.sequenceConversionRate ? 
                          `${Math.round(analytics.overallMetrics.sequenceConversionRate * 100)}%` : '0%'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Optimization Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics?.recommendations?.length > 0 ? (
                      analytics.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">{rec}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600">No recommendations available yet. Run your campaign longer to get insights.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Rules</CardTitle>
              <CardDescription>Set up automated responses based on prospect behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Smart Timing</h4>
                  <p className="text-sm text-gray-600 mb-3">Send messages at optimal times based on prospect time zones and engagement history</p>
                  <Switch defaultChecked data-testid="switch-smart-timing" />
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Engagement-Based Progression</h4>
                  <p className="text-sm text-gray-600 mb-3">Automatically advance prospects who engage or pause those who don't</p>
                  <Switch defaultChecked data-testid="switch-engagement-progression" />
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Auto-Personalization</h4>
                  <p className="text-sm text-gray-600 mb-3">Dynamically personalize messages based on prospect activity and profile updates</p>
                  <Switch data-testid="switch-auto-personalization" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}