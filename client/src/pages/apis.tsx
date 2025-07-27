import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ExternalLink,
  Trash2
} from "lucide-react";

interface ApiKeyConfig {
  id: string;
  name: string;
  service: string;
  key: string;
  status: 'active' | 'inactive' | 'error';
  lastVerified: string;
  description: string;
  setupUrl: string;
  capabilities: string[];
}

export default function APIs() {
  const [showKeys, setShowKeys] = useState<{[key: string]: boolean}>({});
  const [editingKeys, setEditingKeys] = useState<{[key: string]: string}>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's API keys
  const { data: apiKeys, isLoading, error } = useQuery({
    queryKey: ["/api/user/api-keys"],
    retry: false,
  });

  // Save API key mutation
  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ service, key }: { service: string; key: string }) => {
      const response = await apiRequest("POST", "/api/user/api-keys", {
        service,
        key
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources/status"] });
      toast({
        title: "API Key Saved",
        description: `${variables.service} API key has been saved and verified successfully.`,
      });
      // Clear the editing state
      setEditingKeys(prev => {
        const newState = { ...prev };
        delete newState[variables.service];
        return newState;
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
        description: "Failed to save API key. Please check the key and try again.",
        variant: "destructive",
      });
    },
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (service: string) => {
      const response = await apiRequest("DELETE", `/api/user/api-keys/${service}`);
      return response.json();
    },
    onSuccess: (data, service) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources/status"] });
      toast({
        title: "API Key Deleted",
        description: `${service} API key has been removed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete API key.",
        variant: "destructive",
      });
    },
  });

  // Test API key mutation
  const testApiKeyMutation = useMutation({
    mutationFn: async (service: string) => {
      const response = await apiRequest("POST", `/api/user/api-keys/${service}/test`);
      return response.json();
    },
    onSuccess: (data, service) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({
        title: "API Key Tested",
        description: `${service} API key is working correctly.`,
      });
    },
    onError: (error) => {
      toast({
        title: "API Key Test Failed",
        description: "The API key appears to be invalid or expired.",
        variant: "destructive",
      });
    },
  });

  const handleSaveKey = (service: string) => {
    const key = editingKeys[service];
    if (!key?.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key.",
        variant: "destructive",
      });
      return;
    }
    saveApiKeyMutation.mutate({ service, key });
  };

  const handleDeleteKey = (service: string) => {
    if (confirm(`Are you sure you want to delete the ${service} API key?`)) {
      deleteApiKeyMutation.mutate(service);
    }
  };

  const toggleKeyVisibility = (service: string) => {
    setShowKeys(prev => ({
      ...prev,
      [service]: !prev[service]
    }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  // Default API services configuration
  const defaultApiServices = [
    {
      id: 'apollo',
      name: 'Apollo.io',
      service: 'apollo',
      description: 'Access to 265M+ contact database for prospect discovery',
      setupUrl: 'https://developer.apollo.io/keys/',
      capabilities: ['Prospect Search', 'Contact Enrichment', 'Company Data']
    },
    {
      id: 'zoominfo',
      name: 'ZoomInfo',
      service: 'zoominfo',
      description: 'B2B contact and company intelligence platform',
      setupUrl: 'https://developers.zoominfo.com/docs/authentication',
      capabilities: ['Contact Enrichment', 'Technographics', 'Intent Data']
    },
    {
      id: 'hunter',
      name: 'Hunter.io',
      service: 'hunter',
      description: 'Email finder and verification service',
      setupUrl: 'https://hunter.io/api-keys',
      capabilities: ['Email Finding', 'Email Verification', 'Domain Search']
    }
  ];

  // Merge default services with user's API keys
  const services = defaultApiServices.map(service => {
    const userKey = apiKeys?.find((key: any) => key.service === service.service);
    return {
      ...service,
      key: userKey?.key || '',
      status: userKey?.status || 'inactive',
      lastVerified: userKey?.lastVerified || '',
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading API configuration...</p>
        </div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">API Configuration</h1>
          <p className="text-gray-600">
            Configure your API keys to enable multi-source data integration and unlock the full power of prospect discovery.
          </p>
        </div>

        {/* Overview Alert */}
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            Your API keys are encrypted and stored securely. They are only used to fetch data from the respective services
            and are never shared with third parties.
          </AlertDescription>
        </Alert>

        {/* API Services */}
        <div className="space-y-4">
          {services.map((service) => (
            <Card key={service.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(service.setupUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Get API Key
                  </Button>
                </div>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Capabilities */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Capabilities</Label>
                  <div className="flex flex-wrap gap-2">
                    {service.capabilities.map((capability) => (
                      <Badge key={capability} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* API Key Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">API Key</Label>
                  
                  {service.key && !editingKeys[service.service] ? (
                    // Display existing key
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                        <span className="font-mono text-sm">
                          {showKeys[service.service] ? service.key : maskKey(service.key)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(service.service)}
                        data-testid={`button-toggle-key-${service.service}`}
                      >
                        {showKeys[service.service] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingKeys(prev => ({ ...prev, [service.service]: service.key }))}
                        data-testid={`button-edit-key-${service.service}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testApiKeyMutation.mutate(service.service)}
                        disabled={testApiKeyMutation.isPending}
                        data-testid={`button-test-key-${service.service}`}
                      >
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteKey(service.service)}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid={`button-delete-key-${service.service}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    // Edit/Add key form
                    <div className="flex items-center space-x-2">
                      <Input
                        type={showKeys[service.service] ? "text" : "password"}
                        placeholder={`Enter your ${service.name} API key`}
                        value={editingKeys[service.service] || ''}
                        onChange={(e) => setEditingKeys(prev => ({ 
                          ...prev, 
                          [service.service]: e.target.value 
                        }))}
                        className="flex-1"
                        data-testid={`input-api-key-${service.service}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(service.service)}
                        data-testid={`button-toggle-visibility-${service.service}`}
                      >
                        {showKeys[service.service] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={() => handleSaveKey(service.service)}
                        disabled={saveApiKeyMutation.isPending}
                        data-testid={`button-save-key-${service.service}`}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      {service.key && (
                        <Button
                          variant="outline"
                          onClick={() => setEditingKeys(prev => {
                            const newState = { ...prev };
                            delete newState[service.service];
                            return newState;
                          })}
                          data-testid={`button-cancel-edit-${service.service}`}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}

                  {service.lastVerified && (
                    <p className="text-xs text-gray-500">
                      Last verified: {new Date(service.lastVerified).toLocaleString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Having trouble setting up your API keys? Here are some common solutions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Make sure your API keys have the correct permissions enabled</li>
              <li>Check that your API keys haven't expired or been revoked</li>
              <li>Verify that your account has sufficient credits or quota remaining</li>
              <li>Ensure there are no IP restrictions blocking access</li>
            </ul>
            <p className="text-sm text-gray-600">
              Contact support if you continue to experience issues with API key configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}