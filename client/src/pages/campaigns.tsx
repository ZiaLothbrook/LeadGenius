import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Send, 
  Play, 
  Pause, 
  Eye, 
  Edit, 
  Copy,
  Archive,
  Mail,
  MessageSquare,
  Phone,
  Layers,
  Plus,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  ShieldCheck,
  DollarSign
} from "lucide-react";

export default function Campaigns() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [executionChannel, setExecutionChannel] = useState<string>("email");
  const [testMode, setTestMode] = useState(true);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: communicationStatus } = useQuery({
    queryKey: ["/api/communication/status"],
    retry: false,
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/campaigns/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  const handlePauseCampaign = (campaignId: string) => {
    updateCampaignMutation.mutate({
      id: campaignId,
      data: { status: "paused" }
    });
  };

  const handleStartCampaign = (campaignId: string) => {
    updateCampaignMutation.mutate({
      id: campaignId,
      data: { status: "active" }
    });
  };

  const executeCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, channel, testMode }: { campaignId: string; channel: string; testMode: boolean }) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/execute`, {
        channel,
        testMode,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const failCount = data.results?.filter((r: any) => !r.success).length || 0;
      
      toast({
        title: "Campaign Executed",
        description: `Successfully sent to ${successCount} prospects. ${failCount} failed.`,
      });
      setShowExecuteDialog(false);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute campaign",
        variant: "destructive",
      });
    },
  });

  const handleExecuteCampaign = () => {
    if (!selectedCampaign) return;
    
    executeCampaignMutation.mutate({
      campaignId: selectedCampaign.id,
      channel: executionChannel,
      testMode,
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "completed": return "secondary";
      case "paused": return "outline";
      case "scheduled": return "outline";
      default: return "outline";
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="w-5 h-5 text-primary" />;
      case "linkedin": return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case "phone": return <Phone className="w-5 h-5 text-emerald-600" />;
      case "multi-channel": return <Layers className="w-5 h-5 text-purple-600" />;
      default: return <Send className="w-5 h-5 text-slate-600" />;
    }
  };

  const getResponseRate = (campaign: any) => {
    if (!campaign.sent || campaign.sent === 0) return "0%";
    return ((campaign.replied / campaign.sent) * 100).toFixed(1) + "%";
  };

  const getOpenRate = (campaign: any) => {
    if (!campaign.sent || campaign.sent === 0) return "0%";
    return ((campaign.opened / campaign.sent) * 100).toFixed(1) + "%";
  };

  const activeCampaigns = campaigns?.filter((c: any) => c.status === "active") || [];
  const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.sent || 0), 0) || 0;
  const avgResponseRate = campaigns?.length > 0 
    ? (campaigns.reduce((sum: number, c: any) => sum + (c.replied || 0), 0) / Math.max(totalSent, 1) * 100).toFixed(1)
    : "0.0";

  if (authLoading || isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-slate-200 rounded mb-2"></div>
                <div className="h-8 bg-slate-200 rounded mb-4"></div>
                <div className="h-3 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Communication Status */}
      {communicationStatus && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Communication Services Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>Email Verification</span>
                </div>
                {communicationStatus.zerobounce?.configured ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      {communicationStatus.zerobounce.credits || 0} credits
                    </span>
                  </div>
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>SMS/Voice</span>
                </div>
                {communicationStatus.twilio?.configured ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      {communicationStatus.twilio.phoneNumber}
                    </span>
                  </div>
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Email Sending</span>
                </div>
                {communicationStatus.sendgrid?.configured ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-600">Pending setup</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Active Campaigns</h3>
              <Play className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-2" data-testid="text-active-campaigns">
              {activeCampaigns.length}
            </p>
            <p className="text-sm text-slate-600">
              {campaigns?.filter((c: any) => c.type === "email").length || 0} email • {campaigns?.filter((c: any) => c.type === "linkedin").length || 0} LinkedIn • {campaigns?.filter((c: any) => c.type === "multi-channel").length || 0} multi-channel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">This Week's Sends</h3>
              <Send className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-2" data-testid="text-week-sends">
              {totalSent.toLocaleString()}
            </p>
            <p className="text-sm text-emerald-600 font-medium">+23% vs last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Avg Response Rate</h3>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-2" data-testid="text-avg-response">
              {avgResponseRate}%
            </p>
            <p className="text-sm text-emerald-600 font-medium">+3.2% this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">All Campaigns</h3>
            <Button data-testid="button-create-campaign">
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header text-left">Campaign</th>
                  <th className="table-header text-left">Type</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-left">Prospects</th>
                  <th className="table-header text-left">Sent</th>
                  <th className="table-header text-left">Opened</th>
                  <th className="table-header text-left">Replied</th>
                  <th className="table-header text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {campaigns?.length > 0 ? (
                  campaigns.map((campaign: any) => (
                    <tr key={campaign.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-slate-900" data-testid={`text-campaign-name-${campaign.id}`}>
                            {campaign.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            Created {new Date(campaign.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          {getChannelIcon(campaign.type)}
                          <span className="text-slate-700 capitalize" data-testid={`text-campaign-type-${campaign.id}`}>
                            {campaign.type.replace("-", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge 
                          variant={getStatusVariant(campaign.status)}
                          data-testid={`badge-campaign-status-${campaign.id}`}
                        >
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <span className="text-slate-900" data-testid={`text-campaign-prospects-${campaign.id}`}>
                          {campaign.totalProspects || 0}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="text-slate-900 font-medium" data-testid={`text-campaign-sent-${campaign.id}`}>
                            {campaign.sent || 0}
                          </p>
                          <p className="text-xs text-slate-500">
                            {campaign.totalProspects > 0 ? Math.round(((campaign.sent || 0) / campaign.totalProspects) * 100) : 0}%
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="text-slate-900 font-medium" data-testid={`text-campaign-opened-${campaign.id}`}>
                            {campaign.opened || 0}
                          </p>
                          <p className="text-xs text-slate-500">
                            {getOpenRate(campaign)}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="text-slate-900 font-medium" data-testid={`text-campaign-replied-${campaign.id}`}>
                            {campaign.replied || 0}
                          </p>
                          <p className="text-xs text-emerald-600 font-medium">
                            {getResponseRate(campaign)}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-view-${campaign.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-edit-${campaign.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {campaign.status === "active" ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handlePauseCampaign(campaign.id)}
                              data-testid={`button-pause-${campaign.id}`}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : campaign.status === "paused" ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStartCampaign(campaign.id)}
                              data-testid={`button-start-${campaign.id}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-archive-${campaign.id}`}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                          {(campaign.status === "active" || campaign.status === "paused") && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => {
                                setSelectedCampaign(campaign);
                                setShowExecuteDialog(true);
                              }}
                              data-testid={`button-execute-${campaign.id}`}
                              className="ml-2"
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              Execute
                            </Button>
                          )}
                          {campaign.status === "completed" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-clone-${campaign.id}`}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-8 text-slate-500">
                      <Send className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No campaigns yet. Create your first campaign to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Execution Dialog */}
      <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Execute Campaign</DialogTitle>
            <DialogDescription>
              Choose how you want to execute the "{selectedCampaign?.name}" campaign.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Channel Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Communication Channel</label>
              <Select value={executionChannel} onValueChange={setExecutionChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Campaign
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      SMS Campaign
                    </div>
                  </SelectItem>
                  <SelectItem value="call">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Voice Call Campaign
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Mode */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="test-mode" 
                checked={testMode} 
                onCheckedChange={(checked) => setTestMode(checked as boolean)}
              />
              <label 
                htmlFor="test-mode" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Test Mode (Simulate sending without actual delivery)
              </label>
            </div>

            {/* Channel-specific warnings */}
            {executionChannel === "email" && !communicationStatus?.sendgrid?.configured && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> SendGrid is not configured. Emails will be queued for sending once you configure SendGrid.
                </AlertDescription>
              </Alert>
            )}

            {executionChannel === "sms" && !communicationStatus?.twilio?.configured && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Twilio is not configured. SMS sending will fail without proper configuration.
                </AlertDescription>
              </Alert>
            )}

            {executionChannel === "call" && !communicationStatus?.twilio?.configured && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Twilio is not configured. Voice calls will fail without proper configuration.
                </AlertDescription>
              </Alert>
            )}

            {/* Cost Estimate */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Estimated Cost</span>
                <DollarSign className="w-4 h-4 text-slate-600" />
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                {executionChannel === "email" && (
                  <>
                    <p>Email verification: ~${((selectedCampaign?.totalProspects || 0) * 0.004).toFixed(2)}</p>
                    {communicationStatus?.sendgrid?.configured && (
                      <p>Email sending: ~${((selectedCampaign?.totalProspects || 0) * 0.001).toFixed(2)}</p>
                    )}
                  </>
                )}
                {executionChannel === "sms" && (
                  <p>SMS sending: ~${((selectedCampaign?.totalProspects || 0) * 0.01).toFixed(2)}</p>
                )}
                {executionChannel === "call" && (
                  <p>Voice calls: ~${((selectedCampaign?.totalProspects || 0) * 0.02).toFixed(2)}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecuteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExecuteCampaign} 
              disabled={executeCampaignMutation.isPending}
              className="min-w-[100px]"
            >
              {executeCampaignMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Executing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Execute {testMode ? "Test" : "Campaign"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
