import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Search, 
  Save, 
  Download, 
  Plus, 
  Eye, 
  Bookmark,
  ChevronDown,
  ChevronUp,
  User
} from "lucide-react";

export default function Discovery() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    search: "",
    industry: "all",
    companySize: "all",
    jobTitle: "",
    location: "",
    technologies: "",
  });
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use search API instead of general prospects endpoint
  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ["/api/prospects/search", searchFilters],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/prospects/search', {
          keywords: searchFilters.search || undefined,
          industry: searchFilters.industry !== "all" ? searchFilters.industry : undefined,
          companySize: searchFilters.companySize !== "all" ? searchFilters.companySize : undefined,
          location: searchFilters.location || undefined,
          jobTitles: searchFilters.jobTitle ? [searchFilters.jobTitle] : undefined,
          technologies: searchFilters.technologies ? searchFilters.technologies.split(',').map(t => t.trim()) : undefined,
          page: 1,
          limit: 50,
      });
      return response.json();
    },
    retry: false,
  });

  const prospects = searchResults?.prospects || [];
  const aiInsights = searchResults?.aiInsights;

  const createProspectMutation = useMutation({
    mutationFn: async (prospectData: any) => {
      const response = await apiRequest("POST", "/api/prospects", prospectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      toast({
        title: "Prospect Added",
        description: "Prospect successfully added to your database",
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

  const handleAddProspect = (prospect: any) => {
    createProspectMutation.mutate({
      name: prospect.name,
      title: prospect.title,
      company: prospect.company,
      industry: prospect.industry,
      location: prospect.location,
      email: prospect.email,
      phone: prospect.phone,
      linkedinUrl: prospect.linkedinUrl,
      dataQuality: prospect.dataQuality,
      verified: prospect.verified,
      priority: prospect.priority,
      notes: `Discovered via search - Score: ${prospect.score}`,
    });
  };

  const handleAddSelectedProspects = () => {
    const prospectsToAdd = prospects.filter((p: any) => selectedProspects.includes(p.id));
    prospectsToAdd.forEach((prospect: any) => {
      handleAddProspect(prospect);
    });
    setSelectedProspects([]);
  };

  const handleSearch = () => {
    refetch();
  };

  const handleSelectProspect = (prospectId: string) => {
    setSelectedProspects(prev => 
      prev.includes(prospectId) 
        ? prev.filter(id => id !== prospectId)
        : [...prev, prospectId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProspects.length === prospects.length) {
      setSelectedProspects([]);
    } else {
      setSelectedProspects(prospects.map((p: any) => p.id));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-slate-400";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Smart Prospect Discovery</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search Keywords</Label>
              <div className="relative mt-2">
                <Input
                  id="search"
                  placeholder="e.g., SaaS, technology, startups..."
                  value={searchFilters.search}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                  data-testid="input-search-keywords"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>
            
            <div>
              <Label>Industry</Label>
              <Select 
                value={searchFilters.industry} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, industry: value }))}
              >
                <SelectTrigger className="mt-2" data-testid="select-industry">
                  <SelectValue placeholder="All Industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Company Size</Label>
              <Select 
                value={searchFilters.companySize} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, companySize: value }))}
              >
                <SelectTrigger className="mt-2" data-testid="select-company-size">
                  <SelectValue placeholder="All Sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="200+">200+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-slate-900">Advanced Filters</h4>
              <Button
                variant="link"
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="button-toggle-advanced"
              >
                <span>{showAdvanced ? "Hide Advanced" : "Show Advanced"}</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </Button>
            </div>
            
            {showAdvanced && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    placeholder="e.g., CEO, VP Sales, Director..."
                    value={searchFilters.jobTitle}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, jobTitle: e.target.value }))}
                    className="mt-2"
                    data-testid="input-job-title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., San Francisco, CA"
                    value={searchFilters.location}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                    className="mt-2"
                    data-testid="input-location"
                  />
                </div>
                
                <div>
                  <Label htmlFor="technologies">Technologies Used</Label>
                  <Input
                    id="technologies"
                    placeholder="e.g., Salesforce, HubSpot..."
                    value={searchFilters.technologies}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, technologies: e.target.value }))}
                    className="mt-2"
                    data-testid="input-technologies"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center space-x-4">
              <Button onClick={handleSearch} data-testid="button-search">
                <Search className="w-4 h-4 mr-2" />
                Search Prospects
              </Button>
              <Button variant="secondary" data-testid="button-save-search">
                <Save className="w-4 h-4 mr-2" />
                Save Search
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              Found: <span className="font-medium text-slate-900">{searchResults?.total || 0} prospects</span>
              {searchResults?.hasMore && <span className="ml-2 text-blue-600">(more available)</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Card */}
      {aiInsights && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <Search className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-blue-900">AI Search Insights</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{aiInsights.intentSignalsDetected}</div>
                <div className="text-sm text-slate-600">Intent Signals</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{aiInsights.lookalikeMatches}</div>
                <div className="text-sm text-slate-600">Lookalike Matches</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{aiInsights.competitiveOpportunities}</div>
                <div className="text-sm text-slate-600">Competitive Opportunities</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className={`text-2xl font-bold ${
                  aiInsights.searchQuality === 'high' ? 'text-green-600' : 
                  aiInsights.searchQuality === 'medium' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {aiInsights.searchQuality.toUpperCase()}
                </div>
                <div className="text-sm text-slate-600">Search Quality</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-2">AI Recommendations</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                {aiInsights.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">AI-Powered Search Results</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-500">
                Showing {prospects.length} of {searchResults?.total || 0} results
              </span>
              <Button variant="secondary" data-testid="button-export-results">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                disabled={selectedProspects.length === 0}
                onClick={handleAddSelectedProspects}
                data-testid="button-add-selected"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Selected to Database
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header">
                    <Checkbox
                      checked={selectedProspects.length === prospects.length && prospects.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="table-header text-left">Contact</th>
                  <th className="table-header text-left">Company</th>
                  <th className="table-header text-left">Title</th>
                  <th className="table-header text-left">Location</th>
                  <th className="table-header text-left">Score</th>
                  <th className="table-header text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prospects.length > 0 ? (
                  prospects.map((prospect: any) => (
                    <tr key={prospect.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <Checkbox
                          checked={selectedProspects.includes(prospect.id)}
                          onCheckedChange={() => handleSelectProspect(prospect.id)}
                          data-testid={`checkbox-prospect-${prospect.id}`}
                        />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback>
                              <User className="w-5 h-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900" data-testid={`text-prospect-name-${prospect.id}`}>
                              {prospect.name}
                            </p>
                            <p className="text-sm text-slate-500" data-testid={`text-prospect-email-${prospect.id}`}>
                              {prospect.email || "Email not available"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-slate-900" data-testid={`text-prospect-company-${prospect.id}`}>
                            {prospect.company}
                          </p>
                          <p className="text-sm text-slate-500" data-testid={`text-prospect-industry-${prospect.id}`}>
                            {prospect.industry}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <span className="text-slate-900" data-testid={`text-prospect-title-${prospect.id}`}>
                            {prospect.title}
                          </span>
                          {prospect.priorityReason && (
                            <p className="text-xs text-blue-600 mt-1" title={prospect.priorityReason}>
                              AI Priority Match
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-slate-600" data-testid={`text-prospect-location-${prospect.id}`}>
                          {prospect.location}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          <div className="w-12 bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${getScoreColor(prospect.aiScore || prospect.score || 0)}`}
                              style={{ width: `${prospect.aiScore || prospect.score || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-slate-700" data-testid={`text-prospect-score-${prospect.id}`}>
                            {prospect.aiScore || prospect.score || 0}
                          </span>
                          {(prospect.intentSignals && prospect.intentSignals.length > 0) && (
                            <div className="flex">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active intent signals"></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`button-view-${prospect.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAddProspect(prospect)}
                            data-testid={`button-add-${prospect.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-save-${prospect.id}`}>
                            <Bookmark className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="table-cell text-center py-8 text-slate-500">
                      <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No prospects found. Try adjusting your search criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {prospects.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Show</span>
                <Select defaultValue="20">
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-slate-600">per page</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="secondary" size="sm" disabled>Previous</Button>
                <div className="flex items-center space-x-1">
                  <Button variant="default" size="sm">1</Button>
                  <Button variant="ghost" size="sm">2</Button>
                  <Button variant="ghost" size="sm">3</Button>
                </div>
                <Button variant="secondary" size="sm">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
