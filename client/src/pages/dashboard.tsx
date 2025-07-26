import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  Users, 
  Send, 
  TrendingUp, 
  Trophy,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Zap,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    retry: false,
  });

  if (isLoading || statsLoading) {
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Prospects</p>
                <p className="text-3xl font-bold text-slate-900" data-testid="text-total-prospects">
                  {stats?.totalProspects || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-emerald-600 font-medium">+12.5%</span>
              <span className="text-sm text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Campaigns</p>
                <p className="text-3xl font-bold text-slate-900" data-testid="text-active-campaigns">
                  {stats?.activeCampaigns || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-emerald-600 font-medium">+2</span>
              <span className="text-sm text-slate-500 ml-2">new this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Response Rate</p>
                <p className="text-3xl font-bold text-slate-900" data-testid="text-response-rate">
                  {stats?.responseRate || "0.0"}%
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-emerald-600 font-medium">+3.2%</span>
              <span className="text-sm text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Conversion Rate</p>
                <p className="text-3xl font-bold text-slate-900" data-testid="text-conversion-rate">
                  {stats?.conversionRate || "0.0"}%
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-emerald-600 font-medium">+1.4%</span>
              <span className="text-sm text-slate-500 ml-2">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Recent Campaigns</h3>
                <Button 
                  variant="link" 
                  onClick={() => setLocation("/campaigns")}
                  data-testid="link-view-all-campaigns"
                >
                  View all
                </Button>
              </div>
              
              <div className="space-y-4">
                {campaignsLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse p-4 bg-slate-50 rounded-lg">
                      <div className="h-4 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded"></div>
                    </div>
                  ))
                ) : campaigns?.length > 0 ? (
                  campaigns.slice(0, 3).map((campaign: any) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          {campaign.type === "email" && <Mail className="w-5 h-5 text-primary" />}
                          {campaign.type === "linkedin" && <MessageSquare className="w-5 h-5 text-blue-600" />}
                          {campaign.type === "phone" && <Phone className="w-5 h-5 text-emerald-600" />}
                          {campaign.type === "multi-channel" && <Send className="w-5 h-5 text-purple-600" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900" data-testid={`text-campaign-name-${campaign.id}`}>
                            {campaign.name}
                          </h4>
                          <p className="text-sm text-slate-500">
                            {campaign.sent || 0} sent • {campaign.opened || 0} opened • {campaign.replied || 0} replied
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={campaign.status === "active" ? "default" : 
                                  campaign.status === "completed" ? "secondary" : "outline"}
                          data-testid={`badge-campaign-status-${campaign.id}`}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Send className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No campaigns yet. Create your first campaign to get started.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Quick Actions</h3>
              
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start p-4 h-auto bg-primary/5 border-primary/20 hover:bg-primary/10"
                  onClick={() => setLocation("/discovery")}
                  data-testid="button-find-prospects"
                >
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                    <Search className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900">Find New Prospects</h4>
                    <p className="text-sm text-slate-600">Discover high-quality leads</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start p-4 h-auto bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                  onClick={() => setLocation("/personalization")}
                  data-testid="button-generate-messages"
                >
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center mr-3">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900">Generate Messages</h4>
                    <p className="text-sm text-slate-600">AI-powered personalization</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start p-4 h-auto bg-amber-50 border-amber-200 hover:bg-amber-100"
                  onClick={() => setLocation("/campaigns")}
                  data-testid="button-launch-campaign"
                >
                  <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center mr-3">
                    <Send className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900">Launch Campaign</h4>
                    <p className="text-sm text-slate-600">Start outreach sequence</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start p-4 h-auto bg-purple-50 border-purple-200 hover:bg-purple-100"
                  onClick={() => setLocation("/analytics")}
                  data-testid="button-view-analytics"
                >
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900">View Analytics</h4>
                    <p className="text-sm text-slate-600">Track performance metrics</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
