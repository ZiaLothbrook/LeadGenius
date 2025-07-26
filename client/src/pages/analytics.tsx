import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import PerformanceChart from "@/components/charts/performance-chart";
import { 
  Download,
  Mail,
  MessageSquare,
  Phone,
  Layers,
  TrendingUp
} from "lucide-react";

export default function Analytics() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState("30days");
  const { toast } = useToast();

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

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    retry: false,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics", { timeRange }],
    retry: false,
  });

  // Calculate metrics from campaigns data
  const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.sent || 0), 0) || 0;
  const totalDelivered = campaigns?.reduce((sum: number, c: any) => sum + (c.delivered || c.sent || 0), 0) || 0;
  const totalOpened = campaigns?.reduce((sum: number, c: any) => sum + (c.opened || 0), 0) || 0;
  const totalClicked = campaigns?.reduce((sum: number, c: any) => sum + (c.clicked || 0), 0) || 0;
  const totalReplied = campaigns?.reduce((sum: number, c: any) => sum + (c.replied || 0), 0) || 0;
  const totalConverted = campaigns?.reduce((sum: number, c: any) => sum + (c.converted || 0), 0) || 0;

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0.0";
  const responseRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0.0";
  const conversionRate = totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : "0.0";

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="w-4 h-4 text-primary" />;
      case "linkedin": return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case "phone": return <Phone className="w-4 h-4 text-emerald-600" />;
      case "multi-channel": return <Layers className="w-4 h-4 text-purple-600" />;
      default: return <Mail className="w-4 h-4 text-slate-600" />;
    }
  };

  const getChannelPerformance = (type: string) => {
    const channelCampaigns = campaigns?.filter((c: any) => c.type === type) || [];
    const sent = channelCampaigns.reduce((sum: number, c: any) => sum + (c.sent || 0), 0);
    const replied = channelCampaigns.reduce((sum: number, c: any) => sum + (c.replied || 0), 0);
    const responseRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
    
    return { sent, replied, responseRate };
  };

  const channelData = [
    { 
      type: "email", 
      name: "Email", 
      icon: Mail, 
      color: "text-primary", 
      bgColor: "bg-primary", 
      performance: getChannelPerformance("email") 
    },
    { 
      type: "linkedin", 
      name: "LinkedIn", 
      icon: MessageSquare, 
      color: "text-blue-600", 
      bgColor: "bg-blue-600", 
      performance: getChannelPerformance("linkedin") 
    },
    { 
      type: "phone", 
      name: "Phone", 
      icon: Phone, 
      color: "text-emerald-600", 
      bgColor: "bg-emerald-600", 
      performance: getChannelPerformance("phone") 
    },
    { 
      type: "multi-channel", 
      name: "Multi-channel", 
      icon: Layers, 
      color: "text-purple-600", 
      bgColor: "bg-purple-600", 
      performance: getChannelPerformance("multi-channel") 
    }
  ];

  const calculateROI = (campaign: any) => {
    const revenue = (campaign.converted || 0) * 5000; // Assuming $5k average deal size
    const cost = (campaign.sent || 0) * 0.5; // Assuming $0.5 per email
    const roi = cost > 0 ? (((revenue - cost) / cost) * 100).toFixed(0) : "0";
    return `+${roi}%`;
  };

  if (authLoading || campaignsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
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
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Total Emails Sent</h3>
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-2" data-testid="text-total-sent">
              {totalSent.toLocaleString()}
            </p>
            <div className="flex items-center text-sm">
              <span className="text-emerald-600 font-medium">+18.2%</span>
              <span className="text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Open Rate</h3>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-2" data-testid="text-open-rate">
              {openRate}%
            </p>
            <div className="flex items-center text-sm">
              <span className="text-emerald-600 font-medium">+2.1%</span>
              <span className="text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Response Rate</h3>
              <MessageSquare className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-2" data-testid="text-response-rate">
              {responseRate}%
            </p>
            <div className="flex items-center text-sm">
              <span className="text-emerald-600 font-medium">+1.8%</span>
              <span className="text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Conversion Rate</h3>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-2" data-testid="text-conversion-rate">
              {conversionRate}%
            </p>
            <div className="flex items-center text-sm">
              <span className="text-emerald-600 font-medium">+0.9%</span>
              <span className="text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Trend Chart */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Performance Trends</h3>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32" data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                  <SelectItem value="6months">Last 6 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <PerformanceChart campaigns={campaigns} timeRange={timeRange} />
          </CardContent>
        </Card>

        {/* Channel Performance */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Channel Performance</h3>
            
            <div className="space-y-6">
              {channelData.map((channel) => {
                const performance = channel.performance;
                const maxSent = Math.max(...channelData.map(c => c.performance.sent));
                const widthPercentage = maxSent > 0 ? (performance.sent / maxSent) * 100 : 0;
                
                return (
                  <div key={channel.type}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <channel.icon className={channel.color} />
                        <span className="text-slate-700 font-medium">{channel.name}</span>
                      </div>
                      <span className="text-slate-900 font-semibold" data-testid={`text-${channel.type}-response-rate`}>
                        {performance.responseRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${channel.bgColor}`}
                        style={{ width: `${widthPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1" data-testid={`text-${channel.type}-stats`}>
                      {performance.sent.toLocaleString()} sent • {performance.replied} responses
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Campaign Performance</h3>
            <div className="flex items-center space-x-3">
              <Button variant="secondary" data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="quarter">Last quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header text-left">Campaign</th>
                  <th className="table-header text-left">Channel</th>
                  <th className="table-header text-left">Sent</th>
                  <th className="table-header text-left">Delivered</th>
                  <th className="table-header text-left">Opened</th>
                  <th className="table-header text-left">Clicked</th>
                  <th className="table-header text-left">Replied</th>
                  <th className="table-header text-left">Converted</th>
                  <th className="table-header text-left">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {campaigns?.length > 0 ? (
                  campaigns.map((campaign: any) => (
                    <tr key={campaign.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-slate-900" data-testid={`text-analytics-campaign-${campaign.id}`}>
                            {campaign.name}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">
                            {campaign.type.replace("-", " ")} campaign
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          {getChannelIcon(campaign.type)}
                          <span className="text-slate-700 capitalize">
                            {campaign.type.replace("-", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-slate-900 font-medium" data-testid={`text-sent-${campaign.id}`}>
                          {campaign.sent || 0}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900 font-medium" data-testid={`text-delivered-${campaign.id}`}>
                            {campaign.delivered || campaign.sent || 0}
                          </span>
                          <span className="text-xs text-slate-500 block">
                            {campaign.sent > 0 ? (((campaign.delivered || campaign.sent) / campaign.sent) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900 font-medium" data-testid={`text-opened-${campaign.id}`}>
                            {campaign.opened || 0}
                          </span>
                          <span className="text-xs text-slate-500 block">
                            {campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900 font-medium" data-testid={`text-clicked-${campaign.id}`}>
                            {campaign.clicked || 0}
                          </span>
                          <span className="text-xs text-slate-500 block">
                            {campaign.sent > 0 ? ((campaign.clicked / campaign.sent) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900 font-medium" data-testid={`text-replied-${campaign.id}`}>
                            {campaign.replied || 0}
                          </span>
                          <span className="text-xs text-emerald-600 font-medium block">
                            {campaign.sent > 0 ? ((campaign.replied / campaign.sent) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900 font-medium" data-testid={`text-converted-${campaign.id}`}>
                            {campaign.converted || 0}
                          </span>
                          <span className="text-xs text-purple-600 font-medium block">
                            {campaign.sent > 0 ? ((campaign.converted / campaign.sent) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-emerald-600 font-semibold" data-testid={`text-roi-${campaign.id}`}>
                          {calculateROI(campaign)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-8 text-slate-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No campaign data available yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
