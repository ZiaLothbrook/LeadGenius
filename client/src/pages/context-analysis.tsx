import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, TrendingUp, Users, MessageSquare, BarChart3, Zap, Target, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ContextAnalysis {
  id: number;
  prospectId: string;
  overallScore: string;
  contextFactors: any;
  personalizationOpportunities: any;
  recommendedApproach: string;
  keyMessages: string[];
  timingScore: string;
  relevanceScore: string;
  authorityScore: string;
  readinessScore: string;
  aiInsights: any;
  riskFactors: string[];
  successFactors: string[];
  nextBestActions: string[];
  analysisType: string;
  processingTime: number;
  createdAt: string;
}

interface CompanyProfile {
  id: number;
  companyName: string;
  domain?: string;
  industry?: string;
  size?: string;
  businessModel?: string;
  revenueRange?: string;
  fundingStage?: string;
  contextScore: string;
  confidence: string;
  lastAnalyzed: string;
}

interface IndustryTrend {
  id: number;
  industry: string;
  marketSize?: string;
  growthRate?: string;
  maturityStage?: string;
  keyDrivers: string[];
  challenges: string[];
  opportunities: string[];
  trendScore: string;
  confidence: string;
  analysisDate: string;
}

export default function ContextAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<'quick' | 'comprehensive' | 'deep'>('comprehensive');
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("");
  const [industryInput, setIndustryInput] = useState("");

  // Fetch context analytics dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/context-analysis/dashboard'],
    refetchInterval: 30000
  });

  // Perform context analysis mutation
  const contextAnalysisMutation = useMutation({
    mutationFn: async (data: { prospectId: string; analysisType: string }) => {
      return await apiRequest('/api/context-analysis/context-analysis', 'POST', data);
    },
    onSuccess: (data) => {
      toast({
        title: "Context Analysis Complete",
        description: `Analysis completed with score: ${data.data.overallScore}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/context-analysis/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to perform context analysis",
        variant: "destructive",
      });
    },
  });

  // Company intelligence analysis mutation
  const companyAnalysisMutation = useMutation({
    mutationFn: async (data: { companyName: string; domain?: string; industry?: string }) => {
      return await apiRequest('/api/context-analysis/company-intelligence', 'POST', data);
    },
    onSuccess: (data) => {
      toast({
        title: "Company Analysis Complete",
        description: `Intelligence gathered for ${data.data.companyName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/context-analysis/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Company Analysis Failed",
        description: error.message || "Failed to analyze company intelligence",
        variant: "destructive",
      });
    },
  });

  // Industry trends analysis mutation
  const industryTrendsMutation = useMutation({
    mutationFn: async (data: { industry: string }) => {
      return await apiRequest('/api/context-analysis/industry-trends', 'POST', data);
    },
    onSuccess: (data) => {
      toast({
        title: "Industry Analysis Complete",
        description: `Trends analyzed for ${data.data.industry} industry`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/context-analysis/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Industry Analysis Failed",
        description: error.message || "Failed to analyze industry trends",
        variant: "destructive",
      });
    },
  });

  const handleContextAnalysis = () => {
    if (!selectedProspectId) {
      toast({
        title: "Prospect Required",
        description: "Please enter a prospect ID for analysis",
        variant: "destructive",
      });
      return;
    }

    contextAnalysisMutation.mutate({
      prospectId: selectedProspectId,
      analysisType: selectedAnalysisType
    });
  };

  const handleCompanyAnalysis = () => {
    if (!companyName) {
      toast({
        title: "Company Name Required",
        description: "Please enter a company name for analysis",
        variant: "destructive",
      });
      return;
    }

    companyAnalysisMutation.mutate({
      companyName,
      domain: companyDomain || undefined,
      industry: companyIndustry || undefined
    });
  };

  const handleIndustryAnalysis = () => {
    if (!industryInput) {
      toast({
        title: "Industry Required",
        description: "Please enter an industry for trend analysis",
        variant: "destructive",
      });
      return;
    }

    industryTrendsMutation.mutate({
      industry: industryInput
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Context Analysis Engine</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered intelligence gathering and context analysis for enhanced prospect understanding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Brain className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Zap className="w-3 h-3 mr-1" />
            Real-time
          </Badge>
        </div>
      </div>

      {/* Dashboard Overview */}
      {!dashboardLoading && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.data.summary.totalAnalyses}</div>
              <p className="text-xs text-muted-foreground">
                Avg Score: {dashboard.data.summary.averageContextScore.toFixed(1)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Personalizations</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.data.summary.totalPersonalizations}</div>
              <p className="text-xs text-muted-foreground">
                Avg Fit: {dashboard.data.summary.averagePersonalizationFit.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Optimizations</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.data.summary.totalOptimizations}</div>
              <p className="text-xs text-muted-foreground">
                Avg Improvement: {dashboard.data.summary.averageImprovementScore.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Company Profiles</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.data.summary.companyProfilesCreated}</div>
              <p className="text-xs text-muted-foreground">
                Intelligence gathered
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="context-analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="context-analysis" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Context Analysis
          </TabsTrigger>
          <TabsTrigger value="company-intelligence" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Company Intelligence
          </TabsTrigger>
          <TabsTrigger value="industry-trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Industry Trends
          </TabsTrigger>
          <TabsTrigger value="message-optimization" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Message Optimization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="context-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prospect Context Analysis</CardTitle>
              <CardDescription>
                Comprehensive AI-powered analysis of prospect context, readiness, and personalization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prospect-id">Prospect ID</Label>
                  <Input
                    id="prospect-id"
                    placeholder="Enter prospect ID for analysis"
                    value={selectedProspectId}
                    onChange={(e) => setSelectedProspectId(e.target.value)}
                    data-testid="input-prospect-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analysis-type">Analysis Type</Label>
                  <Select value={selectedAnalysisType} onValueChange={(value: any) => setSelectedAnalysisType(value)}>
                    <SelectTrigger data-testid="select-analysis-type">
                      <SelectValue placeholder="Select analysis depth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">Quick Analysis</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive Analysis</SelectItem>
                      <SelectItem value="deep">Deep Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={handleContextAnalysis}
                disabled={contextAnalysisMutation.isPending}
                className="w-full"
                data-testid="button-analyze-context"
              >
                {contextAnalysisMutation.isPending ? "Analyzing..." : "Analyze Context"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company-intelligence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Intelligence Gathering</CardTitle>
              <CardDescription>
                AI-powered company profiling with business model analysis, competitive positioning, and decision-making insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-domain">Domain (optional)</Label>
                  <Input
                    id="company-domain"
                    placeholder="company.com"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    data-testid="input-company-domain"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-industry">Industry (optional)</Label>
                  <Input
                    id="company-industry"
                    placeholder="Technology, Healthcare, etc."
                    value={companyIndustry}
                    onChange={(e) => setCompanyIndustry(e.target.value)}
                    data-testid="input-company-industry"
                  />
                </div>
              </div>
              <Button 
                onClick={handleCompanyAnalysis}
                disabled={companyAnalysisMutation.isPending}
                className="w-full"
                data-testid="button-analyze-company"
              >
                {companyAnalysisMutation.isPending ? "Gathering Intelligence..." : "Analyze Company"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="industry-trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Industry Trend Analysis</CardTitle>
              <CardDescription>
                AI-powered market intelligence with trend analysis, growth patterns, and opportunity identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="industry-input">Industry</Label>
                <Input
                  id="industry-input"
                  placeholder="Enter industry name (e.g., SaaS, Healthcare, FinTech)"
                  value={industryInput}
                  onChange={(e) => setIndustryInput(e.target.value)}
                  data-testid="input-industry"
                />
              </div>
              <Button 
                onClick={handleIndustryAnalysis}
                disabled={industryTrendsMutation.isPending}
                className="w-full"
                data-testid="button-analyze-industry"
              >
                {industryTrendsMutation.isPending ? "Analyzing Trends..." : "Analyze Industry Trends"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="message-optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Optimization</CardTitle>
              <CardDescription>
                AI-powered message optimization using context analysis for maximum engagement and conversion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Message optimization interface coming soon</p>
                <p className="text-sm">This feature will provide context-based message optimization and A/B testing</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}