import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Activity, Brain, Users, Zap, Clock, Database, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface PromptLog {
  id: string;
  prompt_type: string;
  model_used: string;
  input_data: any;
  output_data: any;
  user_id?: string;
  created_at: string;
  execution_time_ms?: number;
  token_usage?: any;
  metadata?: any;
}

interface DashboardStats {
  total_prompts: number;
  prompts_today: number;
  average_execution_time: number;
  top_models: Array<{ model: string; count: number }>;
  recent_prompts: PromptLog[];
  error_rate: number;
  total_tokens_used: number;
}

export default function Admin() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptLog | null>(null);

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

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const { data: promptLogs, isLoading: isLogsLoading } = useQuery({
    queryKey: ["/api/admin/prompts"],
    enabled: isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getPromptTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      message_generation: "bg-blue-100 text-blue-800",
      prospect_enrichment: "bg-green-100 text-green-800",
      intent_analysis: "bg-purple-100 text-purple-800",
      message_generation_error: "bg-red-100 text-red-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  if (isLoading || isDashboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Admin Dashboard Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Failed to load admin dashboard. The Python AI service may not be running.
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4"
                data-testid="button-retry-dashboard"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats: DashboardStats = dashboardData || {
    total_prompts: 0,
    prompts_today: 0,
    average_execution_time: 0,
    top_models: [],
    recent_prompts: [],
    error_rate: 0,
    total_tokens_used: 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              AI Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Monitor LLM prompts and system interactions
            </p>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Python AI Service Active
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-prompts">
                {stats.total_prompts.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Prompts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-prompts-today">
                {stats.prompts_today.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-response-time">
                {formatDuration(stats.average_execution_time)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tokens">
                {stats.total_tokens_used.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">Recent Prompts</TabsTrigger>
            <TabsTrigger value="models">Model Usage</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent LLM Interactions</CardTitle>
                <CardDescription>
                  Latest prompts sent to AI models with response details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {stats.recent_prompts.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => setSelectedPrompt(log)}
                        data-testid={`prompt-log-${log.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPromptTypeColor(log.prompt_type)}>
                              {log.prompt_type.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline">
                              {log.model_used}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {log.metadata?.prospect && (
                              <span>Prospect: {log.metadata.prospect}</span>
                            )}
                            {log.metadata?.error && (
                              <span className="text-red-600">Error occurred</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{formatDuration(log.execution_time_ms)}</div>
                          {log.token_usage && (
                            <div className="text-xs">
                              {(log.token_usage.prompt_tokens || 0) + (log.token_usage.completion_tokens || 0)} tokens
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Model Usage Statistics</CardTitle>
                <CardDescription>
                  Distribution of AI model usage across all interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.top_models.map((model, index) => (
                    <div key={model.model} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{model.model}</div>
                          <div className="text-sm text-gray-500">
                            {((model.count / stats.total_prompts) * 100).toFixed(1)}% usage
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-semibold" data-testid={`model-count-${model.model}`}>
                        {model.count}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span className={`font-medium ${stats.error_rate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                        {(stats.error_rate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Response Time</span>
                      <span className="font-medium">
                        {formatDuration(stats.average_execution_time)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Activity</span>
                      <span className="font-medium">
                        {stats.prompts_today} prompts
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Tokens Consumed</span>
                      <span className="font-medium">{stats.total_tokens_used.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Tokens per Prompt</span>
                      <span className="font-medium">
                        {stats.total_prompts > 0 ? Math.round(stats.total_tokens_used / stats.total_prompts) : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Prompt Detail Modal */}
        {selectedPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Prompt Details</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedPrompt(null)}
                    data-testid="button-close-prompt-details"
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Type:</strong> {selectedPrompt.prompt_type}</div>
                      <div><strong>Model:</strong> {selectedPrompt.model_used}</div>
                      <div><strong>Time:</strong> {formatDateTime(selectedPrompt.created_at)}</div>
                      <div><strong>Duration:</strong> {formatDuration(selectedPrompt.execution_time_ms)}</div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Input Data</h4>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(selectedPrompt.input_data, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Output Data</h4>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(selectedPrompt.output_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}