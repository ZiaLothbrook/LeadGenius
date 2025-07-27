import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, MessageSquare, Zap, TrendingUp, Clock, Target } from 'lucide-react';

interface MessageVariation {
  content: string;
  subject?: string;
  personalization_score: number;
  confidence_score: number;
  cta_strength: string;
  tone_match: number;
  personalization_elements: string[];
  word_count: number;
  variation_type: string;
}

interface MessageGenerationResponse {
  variations: MessageVariation[];
  context_analysis: any;
  generation_time_ms: number;
  personalization_insights: string[];
  ab_testing_setup: any;
  nexus_ai_signature: string;
}

interface GenerationRequest {
  prospect_id: string;
  prospect_name: string;
  prospect_company: string;
  prospect_title: string;
  prospect_industry: string;
  prospect_location?: string;
  campaign_goal: string;
  message_type: string;
  tone: string;
  additional_context?: string;
}

export default function MessageGeneration() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<GenerationRequest>({
    prospect_id: 'test-prospect-001',
    prospect_name: '',
    prospect_company: '',
    prospect_title: '',
    prospect_industry: '',
    prospect_location: '',
    campaign_goal: '',
    message_type: 'email',
    tone: 'professional',
    additional_context: ''
  });

  // Fetch templates and configuration
  const { data: templates } = useQuery({
    queryKey: ['/api/messages/templates'],
    retry: false
  });

  // Message generation mutation
  const generateMessagesMutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      return await apiRequest({
        url: '/api/messages/generate',
        method: 'POST',
        data: request
      });
    },
    onSuccess: () => {
      toast({
        title: "Messages Generated Successfully",
        description: "Your personalized message variations are ready for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate messages. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Test generation mutation
  const testGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({
        url: '/api/messages/test-generation',
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Successful",
        description: "Message generation engine is working correctly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Message generation test failed.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof GenerationRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    if (!formData.prospect_name || !formData.prospect_company || !formData.campaign_goal) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    generateMessagesMutation.mutate(formData);
  };

  const handleTestGeneration = () => {
    testGenerationMutation.mutate();
  };

  const result: MessageGenerationResponse | undefined = generateMessagesMutation.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <MessageSquare className="h-6 w-6 text-blue-600" />
        <h1 className="text-3xl font-bold">AI Message Generation</h1>
        <Badge variant="secondary">CARD-008</Badge>
      </div>
      
      <p className="text-muted-foreground">
        Generate hyper-personalized message variations using advanced AI prompt engineering.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Prospect Information</span>
            </CardTitle>
            <CardDescription>
              Enter prospect details for personalized message generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospect_name">Prospect Name *</Label>
                <Input
                  id="prospect_name"
                  data-testid="input-prospect-name"
                  value={formData.prospect_name}
                  onChange={(e) => handleInputChange('prospect_name', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect_title">Job Title</Label>
                <Input
                  id="prospect_title"
                  data-testid="input-prospect-title"
                  value={formData.prospect_title}
                  onChange={(e) => handleInputChange('prospect_title', e.target.value)}
                  placeholder="VP of Engineering"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospect_company">Company *</Label>
                <Input
                  id="prospect_company"
                  data-testid="input-prospect-company"
                  value={formData.prospect_company}
                  onChange={(e) => handleInputChange('prospect_company', e.target.value)}
                  placeholder="TechCorp Inc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect_industry">Industry</Label>
                <Select value={formData.prospect_industry} onValueChange={(value) => handleInputChange('prospect_industry', value)}>
                  <SelectTrigger data-testid="select-prospect-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign_goal">Campaign Goal *</Label>
              <Textarea
                id="campaign_goal"
                data-testid="textarea-campaign-goal"
                value={formData.campaign_goal}
                onChange={(e) => handleInputChange('campaign_goal', e.target.value)}
                placeholder="Increase qualified leads for our AI-powered lead generation platform"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="message_type">Message Type</Label>
                <Select value={formData.message_type} onValueChange={(value) => handleInputChange('message_type', value)}>
                  <SelectTrigger data-testid="select-message-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={formData.tone} onValueChange={(value) => handleInputChange('tone', value)}>
                  <SelectTrigger data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional_context">Additional Context</Label>
              <Textarea
                id="additional_context"
                data-testid="textarea-additional-context"
                value={formData.additional_context}
                onChange={(e) => handleInputChange('additional_context', e.target.value)}
                placeholder="Company recently raised Series B funding, expanding into new markets..."
                rows={2}
              />
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={handleGenerate}
                disabled={generateMessagesMutation.isPending}
                className="flex-1"
                data-testid="button-generate"
              >
                {generateMessagesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Generate Messages
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleTestGeneration}
                disabled={testGenerationMutation.isPending}
                data-testid="button-test"
              >
                {testGenerationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Generated Messages</span>
            </CardTitle>
            <CardDescription>
              AI-generated message variations with personalization scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <Tabs defaultValue="variations" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="variations">Variations</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="testing">A/B Testing</TabsTrigger>
                </TabsList>
                
                <TabsContent value="variations" className="space-y-4">
                  {result.variations.map((variation, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          Variation {index + 1} ({variation.variation_type})
                        </Badge>
                        <div className="text-right text-sm">
                          <div className="font-medium text-green-600">
                            {variation.personalization_score.toFixed(1)}% Personalization
                          </div>
                          <div className="text-muted-foreground">
                            {variation.word_count} words
                          </div>
                        </div>
                      </div>
                      
                      {variation.subject && (
                        <div className="mb-2">
                          <Label className="text-sm font-medium">Subject:</Label>
                          <p className="text-sm font-medium text-blue-600">{variation.subject}</p>
                        </div>
                      )}
                      
                      <div className="mb-3">
                        <Label className="text-sm font-medium">Message:</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">
                          {variation.content}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label>Confidence</Label>
                          <Progress value={variation.confidence_score} className="mt-1" />
                          <span className="text-xs text-muted-foreground">
                            {variation.confidence_score.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <Label>Tone Match</Label>
                          <Progress value={variation.tone_match} className="mt-1" />
                          <span className="text-xs text-muted-foreground">
                            {variation.tone_match.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <Label>CTA Strength</Label>
                          <Badge variant="outline" className="mt-1">
                            {variation.cta_strength}
                          </Badge>
                        </div>
                      </div>
                      
                      {variation.personalization_elements.length > 0 && (
                        <div className="mt-3">
                          <Label className="text-sm font-medium">Personalization Elements:</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {variation.personalization_elements.map((element, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {element}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="analytics" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <Label>Generation Time</Label>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {(result.generation_time_ms / 1000).toFixed(2)}s
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Target: &lt;5 seconds
                      </p>
                    </Card>
                    
                    <Card className="p-4">
                      <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4 text-green-600" />
                        <Label>Avg Personalization</Label>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {(result.variations.reduce((sum, v) => sum + v.personalization_score, 0) / result.variations.length).toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Target: &gt;80%
                      </p>
                    </Card>
                  </div>
                  
                  <div>
                    <Label className="font-medium">Personalization Insights:</Label>
                    <ul className="mt-2 space-y-1">
                      {result.personalization_insights.map((insight, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start">
                          <span className="mr-2">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
                
                <TabsContent value="testing" className="space-y-4">
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      A/B testing setup is automatically configured for your message variations.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid gap-4">
                    <div>
                      <Label className="font-medium">Test Configuration:</Label>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Test ID:</span>
                          <code className="bg-muted px-2 py-1 rounded">
                            {result.ab_testing_setup.test_id}
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span>{result.ab_testing_setup.test_duration_days} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Sample Size:</span>
                          <span>{result.ab_testing_setup.minimum_sample_size}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-medium">Metrics to Track:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.ab_testing_setup.metrics_to_track.map((metric: string, index: number) => (
                          <Badge key={index} variant="outline">
                            {metric.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : generateMessagesMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Generating personalized messages...</span>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Fill in the prospect information and click "Generate Messages" to create personalized variations.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nexus.ai Signature */}
      {result && (
        <Alert>
          <MessageSquare className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {result.nexus_ai_signature}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}