import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Zap, 
  Copy, 
  Edit, 
  Save, 
  Send,
  Info,
  CheckCircle
} from "lucide-react";

export default function Personalization() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [messageType, setMessageType] = useState("email");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [tone, setTone] = useState("professional");
  const [additionalContext, setAdditionalContext] = useState("");
  const [enableABTesting, setEnableABTesting] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessages, setGeneratedMessages] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: prospects, isLoading: prospectsLoading } = useQuery({
    queryKey: ["/api/prospects"],
    retry: false,
  });

  const generateMessageMutation = useMutation({
    mutationFn: async () => {
      const selectedProspect = (prospects as any[])?.find((p: any) => p.id === selectedProspectId);
      if (!selectedProspect) throw new Error("No prospect selected");
      
      const payload = {
        prospect: {
          name: selectedProspect.name,
          title: selectedProspect.title,
          company: selectedProspect.company,
          industry: selectedProspect.industry,
          email: selectedProspect.email,
        },
        campaignContext: {
          productName: "AI Lead Generation Platform",
          productDescription: campaignGoal || "Revolutionary platform for intelligent prospect discovery",
          valueProposition: "Transform your sales process with AI-powered insights",
          callToAction: "Schedule a quick demo",
        },
        messageOptions: {
          tone: tone as "professional" | "casual" | "friendly" | "executive",
          length: "medium" as const,
          personalizationLevel: "hyper-personalized" as const,
          includeDataPoints: ["company", "industry", "role"],
          templateType: messageType === "email" ? "cold-email" : "linkedin",
        },
      };
      
      const response = await apiRequest("POST", "/api/messages/generate", payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedMessages([data]);
      setIsGenerating(false);
      if (data.variants && data.variants.length > 0) {
        setSelectedVariant(data.id);
      }
      toast({
        title: "AI Message Generated",
        description: `Personalized message created with ${data.metadata?.personalizationPoints?.length || 0} personalization points`,
      });
    },
    onError: (error) => {
      setIsGenerating(false);
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
        description: "Failed to generate personalized messages",
        variant: "destructive",
      });
    },
  });

  const handleGenerateMessage = () => {
    if (!selectedProspectId || !campaignGoal) {
      toast({
        title: "Error",
        description: "Please select a prospect and campaign goal",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    generateMessageMutation.mutate();
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariant(variantId);
    toast({
      title: "Variant Selected",
      description: "Message variant selected for campaign",
    });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-emerald-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-amber-600";
    return "text-slate-600";
  };

  const getPredictedResponseRate = (variant: string) => {
    // Mock prediction based on variant
    return variant === "A" ? "18%" : "24%";
  };

  if (authLoading || prospectsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 bg-slate-200 rounded mb-4"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Configuration */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">AI Message Generator</h3>
            
            {/* Prospect Selection */}
            <div className="mb-6">
              <Label>Select Prospect</Label>
              <Select value={selectedProspectId} onValueChange={setSelectedProspectId}>
                <SelectTrigger className="mt-2" data-testid="select-prospect">
                  <SelectValue placeholder="Choose a prospect" />
                </SelectTrigger>
                <SelectContent>
                  {(prospects as any[])?.map((prospect: any) => (
                    <SelectItem key={prospect.id} value={prospect.id}>
                      {prospect.name} - {prospect.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message Type */}
            <div className="mb-6">
              <Label>Message Type</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  variant={messageType === "email" ? "default" : "outline"}
                  onClick={() => setMessageType("email")}
                  className="text-sm"
                  data-testid="button-type-email"
                >
                  Email
                </Button>
                <Button
                  variant={messageType === "linkedin" ? "default" : "outline"}
                  onClick={() => setMessageType("linkedin")}
                  className="text-sm"
                  data-testid="button-type-linkedin"
                >
                  LinkedIn
                </Button>
                <Button
                  variant={messageType === "phone_script" ? "default" : "outline"}
                  onClick={() => setMessageType("phone_script")}
                  className="text-sm"
                  data-testid="button-type-phone"
                >
                  Phone Script
                </Button>
              </div>
            </div>

            {/* Campaign Goal */}
            <div className="mb-6">
              <Label>Campaign Goal</Label>
              <Select value={campaignGoal} onValueChange={setCampaignGoal}>
                <SelectTrigger className="mt-2" data-testid="select-campaign-goal">
                  <SelectValue placeholder="Select campaign goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule_demo">Schedule a demo</SelectItem>
                  <SelectItem value="discovery_call">Book a discovery call</SelectItem>
                  <SelectItem value="download_whitepaper">Download whitepaper</SelectItem>
                  <SelectItem value="pricing_info">Request pricing information</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tone and Style */}
            <div className="mb-6">
              <Label>Tone & Style</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={tone === "professional" ? "default" : "outline"}
                  onClick={() => setTone("professional")}
                  className="text-sm"
                  data-testid="button-tone-professional"
                >
                  Professional
                </Button>
                <Button
                  variant={tone === "casual" ? "default" : "outline"}
                  onClick={() => setTone("casual")}
                  className="text-sm"
                  data-testid="button-tone-casual"
                >
                  Casual
                </Button>
                <Button
                  variant={tone === "friendly" ? "default" : "outline"}
                  onClick={() => setTone("friendly")}
                  className="text-sm"
                  data-testid="button-tone-friendly"
                >
                  Friendly
                </Button>
                <Button
                  variant={tone === "direct" ? "default" : "outline"}
                  onClick={() => setTone("direct")}
                  className="text-sm"
                  data-testid="button-tone-direct"
                >
                  Direct
                </Button>
              </div>
            </div>

            {/* Additional Context */}
            <div className="mb-6">
              <Label htmlFor="context">Additional Context (Optional)</Label>
              <Textarea
                id="context"
                rows={3}
                placeholder="e.g., They recently hired 10 new engineers, raised Series B funding..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="mt-2"
                data-testid="textarea-context"
              />
            </div>

            {/* Generate Button */}
            <Button 
              className="w-full mb-6" 
              onClick={handleGenerateMessage}
              disabled={isGenerating || !selectedProspectId || !campaignGoal}
              data-testid="button-generate"
            >
              <Zap className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate Personalized Message"}
            </Button>

            {/* A/B Testing */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-900">A/B Testing</h4>
                <Switch
                  checked={enableABTesting}
                  onCheckedChange={setEnableABTesting}
                  data-testid="switch-ab-testing"
                />
              </div>
              <p className="text-sm text-slate-600">Generate multiple message variations for testing</p>
            </div>
          </CardContent>
        </Card>

        {/* Generated Messages */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Generated Messages</h3>
              {generatedMessages.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-500" data-testid="text-ai-confidence">
                    AI Confidence: {generatedMessages[0]?.aiConfidence || 94}%
                  </span>
                  <Info className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>

            {/* Message Variants */}
            <div className="space-y-6">
              {generatedMessages.length > 0 ? (
                <>
                  {/* Main Message */}
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="default" data-testid="badge-main">
                          Main Message
                        </Badge>
                        <span className="text-sm text-slate-500 capitalize">{tone} tone</span>
                        {generatedMessages[0].metadata && (
                          <span className="text-xs text-slate-500">
                            {generatedMessages[0].metadata.readingTime} read
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCopyMessage(generatedMessages[0].body)}
                          data-testid="button-copy-main"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid="button-edit-main"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 mb-3">
                      {generatedMessages[0].subject && (
                        <p className="text-sm text-slate-700 mb-3" data-testid="text-subject-main">
                          <strong>Subject:</strong> {generatedMessages[0].subject}
                        </p>
                      )}
                      <div 
                        className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
                        data-testid="text-content-main"
                      >
                        {generatedMessages[0].body}
                      </div>
                    </div>
                    
                    {generatedMessages[0].metadata && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {generatedMessages[0].metadata.personalizationPoints.map((point: any, idx: any) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {point}
                            </Badge>
                          ))}
                        </div>
                        {generatedMessages[0].metadata.complianceCheck && !generatedMessages[0].metadata.complianceCheck.isCompliant && (
                          <p className="text-xs text-amber-600 mt-2">
                            ⚠️ {generatedMessages[0].metadata.complianceCheck.suggestions.join(". ")}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        <span>Score: {generatedMessages[0].personalizationScore}/100</span>
                        <span className={getConfidenceColor(generatedMessages[0].aiConfidence)}>
                          Confidence: {generatedMessages[0].aiConfidence}%
                        </span>
                        {generatedMessages[0].metadata && (
                          <span>CTA Strength: {generatedMessages[0].metadata.callToActionStrength}/10</span>
                        )}
                      </div>
                      <Button 
                        variant={selectedVariant === generatedMessages[0].id ? "default" : "secondary"}
                        size="sm"
                        onClick={() => handleSelectVariant(generatedMessages[0].id)}
                        data-testid="button-select-main"
                      >
                        {selectedVariant === generatedMessages[0].id ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Selected
                          </>
                        ) : (
                          "Select Main Version"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Variants */}
                  {generatedMessages[0].variants && generatedMessages[0].variants.length > 0 && (
                    <>
                      <h4 className="font-medium text-slate-900 mb-3">A/B Test Variants</h4>
                      {generatedMessages[0].variants.map((variant: any, index: any) => (
                        <div key={variant.id} className="border border-slate-200 rounded-lg p-4 mb-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" data-testid={`badge-variant-${index}`}>
                                {variant.description}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleCopyMessage(variant.body)}
                                data-testid={`button-copy-variant-${index}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-slate-50 rounded-lg p-4 mb-3">
                            {variant.subject && (
                              <p className="text-sm text-slate-700 mb-3" data-testid={`text-subject-variant-${index}`}>
                                <strong>Subject:</strong> {variant.subject}
                              </p>
                            )}
                            <div 
                              className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
                              data-testid={`text-content-variant-${index}`}
                            >
                              {variant.body}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Button 
                              variant={selectedVariant === variant.id ? "default" : "secondary"}
                              size="sm"
                              onClick={() => handleSelectVariant(variant.id)}
                              data-testid={`button-select-variant-${index}`}
                            >
                              {selectedVariant === variant.id ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Selected
                                </>
                              ) : (
                                "Select This Variant"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No messages generated yet.</p>
                  <p className="text-sm">Configure your settings and click generate to create personalized messages.</p>
                </div>
              )}
            </div>

            {/* Performance Predictions */}
            {generatedMessages.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4">Performance Predictions</h4>
                <div className="grid grid-cols-2 gap-4">
                  {generatedMessages.map((message, index) => (
                    <div key={message.id} className="text-center p-3 bg-primary/5 rounded-lg">
                      <p className="text-sm text-slate-600">Variant {message.variant}</p>
                      <p className="text-lg font-semibold text-primary" data-testid={`text-prediction-${message.variant}`}>
                        {getPredictedResponseRate(message.variant)} response rate
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {generatedMessages.length > 0 && (
              <div className="flex items-center space-x-3 mt-6">
                <Button variant="secondary" className="flex-1" data-testid="button-save-template">
                  <Save className="w-4 h-4 mr-2" />
                  Save as Template
                </Button>
                <Button className="flex-1" data-testid="button-add-to-campaign">
                  <Send className="w-4 h-4 mr-2" />
                  Add to Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
