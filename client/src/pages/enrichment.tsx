import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  CloudUpload, 
  Plus, 
  Play, 
  Download, 
  ArrowRight,
  CheckCircle,
  Clock,
  TriangleAlert,
  PlusCircle,
  User
} from "lucide-react";

export default function Enrichment() {
  const [newProspect, setNewProspect] = useState({
    name: "",
    company: "",
    email: "",
  });
  const [enrichmentQueue, setEnrichmentQueue] = useState<string[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["/api/prospects"],
    retry: false,
  });

  const createProspectMutation = useMutation({
    mutationFn: async (prospectData: any) => {
      const response = await apiRequest("POST", "/api/prospects", prospectData);
      return response.json();
    },
    onSuccess: (newProspect) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setEnrichmentQueue(prev => [...prev, newProspect.id]);
      setNewProspect({ name: "", company: "", email: "" });
      toast({
        title: "Success",
        description: "Prospect added to enrichment queue",
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
        description: "Failed to add prospect",
        variant: "destructive",
      });
    },
  });

  const enrichProspectMutation = useMutation({
    mutationFn: async (prospectId: string) => {
      const response = await apiRequest("POST", `/api/prospects/${prospectId}/enrich`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      toast({
        title: "Success",
        description: "Prospect data enriched successfully",
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
        description: "Failed to enrich prospect data",
        variant: "destructive",
      });
    },
  });

  const handleAddProspect = () => {
    if (!newProspect.name || !newProspect.company) {
      toast({
        title: "Error",
        description: "Name and company are required",
        variant: "destructive",
      });
      return;
    }

    createProspectMutation.mutate(newProspect);
  };

  const handleStartEnrichment = async () => {
    if (enrichmentQueue.length === 0) return;

    setIsEnriching(true);
    setEnrichmentProgress(0);

    for (let i = 0; i < enrichmentQueue.length; i++) {
      const prospectId = enrichmentQueue[i];
      try {
        await enrichProspectMutation.mutateAsync(prospectId);
        setEnrichmentProgress(((i + 1) / enrichmentQueue.length) * 100);
      } catch (error) {
        console.error("Enrichment error for prospect:", prospectId, error);
      }
    }

    setIsEnriching(false);
    setEnrichmentQueue([]);
    toast({
      title: "Enrichment Complete",
      description: "All prospects have been processed",
    });
  };

  const getDataQualityIndicator = (prospect: any) => {
    const hasEmail = prospect.email && prospect.email.length > 0;
    const hasPhone = prospect.phone && prospect.phone.length > 0;
    const isVerified = prospect.verified;

    if (isVerified && hasEmail && hasPhone) {
      return { icon: CheckCircle, color: "text-emerald-500", text: "Complete" };
    } else if (hasEmail || hasPhone) {
      return { icon: TriangleAlert, color: "text-amber-500", text: "Partial" };
    } else {
      return { icon: Clock, color: "text-slate-400", text: "Pending" };
    }
  };

  const enrichedProspects = prospects?.filter((p: any) => p.verified || p.dataQuality > 50) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 bg-slate-200 rounded mb-4"></div>
              <div className="h-32 bg-slate-200 rounded mb-4"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload/Import Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Import Prospect List</h3>
              
              {/* File Upload Area */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <CloudUpload className="w-6 h-6 text-primary" />
                </div>
                <p className="text-slate-900 font-medium mb-2">Drop CSV file here</p>
                <p className="text-sm text-slate-500 mb-4">or click to browse files</p>
                <Button variant="secondary" data-testid="button-choose-file">Choose File</Button>
              </div>

              {/* Manual Entry */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-medium text-slate-900 mb-4">Or Add Manually</h4>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Full Name"
                      value={newProspect.name}
                      onChange={(e) => setNewProspect(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-2"
                      data-testid="input-prospect-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      placeholder="Company Name"
                      value={newProspect.company}
                      onChange={(e) => setNewProspect(prev => ({ ...prev, company: e.target.value }))}
                      className="mt-2"
                      data-testid="input-prospect-company"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@company.com"
                      value={newProspect.email}
                      onChange={(e) => setNewProspect(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-2"
                      data-testid="input-prospect-email"
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleAddProspect}
                    disabled={createProspectMutation.isPending}
                    data-testid="button-add-to-queue"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Enrichment Queue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrichment Queue and Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Enrichment Queue</h3>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-500" data-testid="text-queue-count">
                    {enrichmentQueue.length} prospects pending
                  </span>
                  <Button 
                    onClick={handleStartEnrichment}
                    disabled={enrichmentQueue.length === 0 || isEnriching}
                    data-testid="button-start-enrichment"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Enrichment
                  </Button>
                </div>
              </div>

              {/* Enrichment Progress */}
              {isEnriching && (
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Enriching prospects...</span>
                    <span className="text-sm text-slate-500">
                      {Math.round(enrichmentProgress)}% completed
                    </span>
                  </div>
                  <Progress value={enrichmentProgress} className="w-full" />
                </div>
              )}

              {/* Enrichment Results */}
              <div className="space-y-4">
                {enrichedProspects.length > 0 ? (
                  enrichedProspects.map((prospect: any) => {
                    const qualityIndicator = getDataQualityIndicator(prospect);
                    const QualityIcon = qualityIndicator.icon;
                    
                    return (
                      <div key={prospect.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12">
                              <AvatarFallback>
                                <User className="w-6 h-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-medium text-slate-900" data-testid={`text-enriched-name-${prospect.id}`}>
                                  {prospect.name}
                                </h4>
                                <Badge 
                                  variant={prospect.verified ? "default" : "secondary"}
                                  data-testid={`badge-enriched-status-${prospect.id}`}
                                >
                                  {prospect.verified ? "Enriched" : "Partial Data"}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">Email</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-email-${prospect.id}`}>
                                    {prospect.email || "Not found"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Phone</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-phone-${prospect.id}`}>
                                    {prospect.phone || "Not found"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Title</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-title-${prospect.id}`}>
                                    {prospect.title || "Not available"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Company</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-company-${prospect.id}`}>
                                    {prospect.company}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Industry</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-industry-${prospect.id}`}>
                                    {prospect.industry || "Not available"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Location</p>
                                  <p className="text-slate-900 font-medium" data-testid={`text-enriched-location-${prospect.id}`}>
                                    {prospect.location || "Not available"}
                                  </p>
                                </div>
                              </div>

                              {/* Data Quality Indicators */}
                              <div className="flex items-center space-x-4 mt-3">
                                <div className="flex items-center space-x-2">
                                  <QualityIcon className={`w-4 h-4 ${qualityIndicator.color}`} />
                                  <span className="text-xs text-slate-600" data-testid={`text-data-quality-${prospect.id}`}>
                                    {qualityIndicator.text}
                                  </span>
                                </div>
                                {prospect.verified && (
                                  <div className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs text-slate-600">Verified</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs text-slate-600">Updated recently</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="text-right">
                              <p className="text-sm font-medium text-slate-900" data-testid={`text-confidence-${prospect.id}`}>
                                {prospect.dataQuality || 85}% Accuracy
                              </p>
                              <p className="text-xs text-slate-500">Confidence Score</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-add-to-campaign-${prospect.id}`}
                            >
                              <PlusCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Database className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No enriched prospects yet. Add prospects to get started.</p>
                  </div>
                )}
              </div>

              {/* Bulk Actions */}
              {enrichedProspects.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-slate-600" data-testid="text-enriched-count">
                      {enrichedProspects.length} prospects enriched
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-sm text-slate-600">Credits used: {enrichedProspects.length * 2}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button variant="secondary" data-testid="button-export-enriched">
                      <Download className="w-4 h-4 mr-2" />
                      Export Results
                    </Button>
                    <Button data-testid="button-add-all-to-campaign">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Add to Campaign
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
