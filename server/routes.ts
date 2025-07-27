import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth, isAuthenticatedLocal, createAdminUser } from "./localAuth";
import { z } from "zod";
import { aiService } from "./services/aiService";
import { pythonAI } from "./services/pythonAiClient";
import { prospectSearchService, searchFiltersSchema } from "./services/prospectSearchService";
import { prospectDiscoveryService } from "./services/prospectDiscoveryService";
import { dataAggregationService } from "./services/dataAggregationService";
import { messageGenerationService } from "./services/messageGenerationService";
import { campaignExecutionService } from "./services/campaignExecutionService";
import { emailVerificationService } from "./services/emailVerificationService";
import { communicationService } from "./services/communicationService";
import { linkedinMessagingService } from "./services/linkedinMessagingService";
import { postmarkService } from "./services/postmarkService";
import { postmarkServerManager } from "./services/postmarkServerManager";
import { apiGateway } from "./middleware/apiGateway";
import { apiDocumentation } from "./middleware/apiDocumentation";
import { apiMonitoring } from "./middleware/apiMonitoring";
import { setupApiGatewayRoutes } from "./routes/apiGatewayRoutes";
import { setupCacheRoutes } from "./routes/cacheRoutes";
import { setupEmailVerificationRoutes } from "./routes/emailVerificationRoutes";
import searchAnalyticsRoutes from "./routes/searchAnalyticsRoutes";
import contextAnalysisRoutes from "./routes/contextAnalysisRoutes";
import { messageOptimizationRoutes } from "./routes/messageOptimizationRoutes";
import campaignSchedulingRoutes from "./routes/campaignSchedulingRoutes";
import responseDetectionRoutes from "./routes/responseDetectionRoutes";
import deliverabilityRoutes from "./routes/deliverabilityRoutes";
import { redisClient } from "./services/redisClient";
import { cacheService } from "./services/cacheService";
import { sessionCacheService } from "./services/sessionCacheService";
import { prospectCacheService } from "./services/prospectCacheService";
import {
  cacheResponse,
  invalidateCache,
  invalidateUserCache,
  cacheProspectData,
  cacheSearchResults,
  cacheApiResponse
} from "./middleware/cacheMiddleware";
import {
  insertProspectSchema,
  insertCampaignSchema,
  insertMessageSchema,
  insertCampaignProspectSchema,
} from "@shared/schema";

// Helper function to mask API keys for security
function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

// Helper function to test API keys
async function testApiKey(service: string, apiKey: string): Promise<boolean> {
  try {
    switch (service) {
      case 'apollo':
        // Test Apollo API key by making a simple request
        const { ApolloClient } = await import('./services/dataSourceClients/apolloClient');
        const apolloClient = new ApolloClient(apiKey);
        const testResult = await apolloClient.searchContacts({
          q_keywords: 'test',
          page: 1,
          per_page: 1
        });
        return testResult.success;
        
      case 'zoominfo':
        // Test ZoomInfo API key
        const { ZoomInfoClient } = await import('./services/dataSourceClients/zoomInfoClient');
        const zoomInfoClient = new ZoomInfoClient(apiKey);
        // Simulate a test - ZoomInfo requires more complex auth, so we'll assume valid format
        return apiKey.length > 10;
        
      case 'hunter':
        // Test Hunter API key
        const { HunterClient } = await import('./services/dataSourceClients/hunterClient');
        const hunterClient = new HunterClient(apiKey);
        const hunterTest = await hunterClient.getAccountInfo();
        return hunterTest.success;
        
      default:
        return false;
    }
  } catch (error) {
    console.error(`API key test failed for ${service}:`, error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize API Gateway middleware stack
  console.log('🌐 Setting up API Gateway...');
  apiGateway.initializeMiddleware(app);
  
  // Initialize API monitoring
  apiMonitoring.initialize();
  app.use(apiMonitoring.monitorRequest());
  
  // Initialize API documentation
  apiDocumentation.initializeDocumentation(app);
  
  // Initialize Redis cache system
  console.log('🔴 Setting up Redis caching system...');
  await redisClient.healthCheck();
  console.log('✅ Redis cache system initialized');
  
  // Auth middleware - setup both Replit and local auth
  await setupAuth(app);
  await setupLocalAuth(app);
  
  // Create admin user if it doesn't exist
  await createAdminUser();

  // Custom authentication middleware that handles both Replit and local auth
  const isAuthenticatedLocal = async (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      // Check if it's a local user (has id directly) or Replit user (has claims)
      if (req.user.id || (req.user.claims && req.user.claims.sub)) {
        return next();
      }
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticatedLocal, async (req: any, res) => {
    try {
      let userId: string;
      // Handle both local auth (user.id) and Replit auth (user.claims.sub)
      if (req.user.id) {
        userId = req.user.id;
      } else if (req.user.claims && req.user.claims.sub) {
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Invalid user session" });
      }
      
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });



  // Bulk Message Generation API with cache invalidation
  app.post('/api/messages/generate-bulk', 
    isAuthenticatedLocal, 
    invalidateUserCache(),
    async (req: any, res) => {
    try {
      console.log("📧 Bulk message generation request for", req.body.prospects?.length, "prospects");
      
      const bulkResponse = await messageGenerationService.generateBulkMessages(req.body);
      
      console.log("✅ Bulk generation completed:", {
        totalGenerated: bulkResponse.totalGenerated,
        processingTime: bulkResponse.processingTime,
      });
      
      res.json(bulkResponse);
    } catch (error) {
      console.error("❌ Error in bulk message generation:", error);
      res.status(500).json({ 
        message: "Failed to generate bulk messages",
        error: (error as Error).message 
      });
    }
  });

  // Dashboard stats with caching
  app.get('/api/dashboard/stats', 
    isAuthenticatedLocal, 
    cacheApiResponse(300), // 5 minutes cache
    async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // TEMPORARY TEST ENDPOINT - Remove after Apollo testing
  app.post('/api/test/prospects/search', async (req: any, res) => {
    try {
      console.log('🧪 TEST ENDPOINT: Apollo API integration test');
      console.log('🔍 Test search parameters:', JSON.stringify(req.body, null, 2));
      
      const { keywords, industry, companySize, location, jobTitles, technologies, page, limit } = req.body;
      
      const results = await prospectDiscoveryService.searchProspects({
        keywords: keywords || 'technology startups',
        industry: industry || 'technology',
        companySize: companySize || '51-200',
        location,
        jobTitles,
        technologies,
        page: page || 1,
        limit: limit || 10
      }, '65594c27-8659-44fe-b287-5a1cd88ce289'); // Use existing user ID

      console.log('📊 TEST RESULTS:', {
        success: results.success,
        totalResults: results.totalResults,
        prospectsReturned: results.prospects.length,
        dataSourcesUsed: results.searchInsights.dataSourcesUsed,
        missingApiKeys: results.searchInsights.missingApiKeys
      });
      
      res.json({
        test: true,
        apolloApiWorking: results.totalResults > 0,
        prospects: results.prospects,
        total: results.totalResults,
        searchInsights: results.searchInsights,
        pagination: results.pagination
      });
    } catch (error: any) {
      console.error("TEST ENDPOINT ERROR:", error);
      res.status(500).json({ 
        test: true,
        error: error.message,
        apolloApiWorking: false
      });
    }
  });

  // Prospect routes with caching
  app.post('/api/prospects/search', 
    isAuthenticatedLocal, 
    cacheSearchResults(),
    async (req: any, res) => {
    try {
      console.log('🔍 Raw request body:', JSON.stringify(req.body, null, 2));
      
      const { keywords, industry, companySize, location, jobTitles, technologies, page, limit } = req.body;
      
      console.log('🔍 Extracted search parameters:', {
        keywords,
        industry,
        companySize, 
        location,
        jobTitles,
        technologies,
        page,
        limit
      });
      
      const userId = req.user.id || req.user.claims?.sub;
      
      console.log('🔍 Starting prospect discovery search with criteria:', {
        keywords: keywords || '',
        industry,
        companySize,
        location,
        jobTitles,
        technologies,
        page: page || 1,
        limit: limit || 50
      });

      const results = await prospectDiscoveryService.searchProspects({
        keywords: keywords || '',
        industry,
        companySize,
        location,
        jobTitles,
        technologies,
        page: page || 1,
        limit: limit || 50
      }, userId);

      console.log('📊 Search results summary:', {
        success: results.success,
        totalResults: results.totalResults,
        prospectsReturned: results.prospects.length,
        dataSourcesUsed: results.searchInsights.dataSourcesUsed,
        missingApiKeys: results.searchInsights.missingApiKeys
      });
      
      // Transform the response to match frontend expectations
      const response = {
        prospects: results.prospects.map((p: any) => ({
          ...p,
          score: p.aiScore || 50,
          verified: p.dataQuality > 0.7,
          priority: p.aiScore && p.aiScore > 70 ? 'high' : 'medium'
        })),
        total: results.totalResults,
        hasMore: results.pagination.hasMore,
        aiInsights: {
          intentSignalsDetected: results.prospects.filter((p: any) => p.intentSignals && p.intentSignals.length > 0).length,
          lookalikeMatches: Math.floor(results.prospects.length * 0.3),
          competitiveOpportunities: Math.floor(results.prospects.length * 0.2),
          searchQuality: results.searchInsights.averageConfidence > 0.7 ? 'high' : 
                        results.searchInsights.averageConfidence > 0.5 ? 'medium' : 'low',
          recommendations: [
            results.searchInsights.missingApiKeys && results.searchInsights.missingApiKeys.length > 0
              ? `Add API keys for ${results.searchInsights.missingApiKeys.join(', ')} to get more results`
              : 'All data sources are configured',
            results.totalResults > 50 ? 'Consider refining your search for better targeting' : 'Try broader search criteria for more results',
            results.searchInsights.topIndustries.length > 0 
              ? `Focus on ${results.searchInsights.topIndustries[0]} industry for best results`
              : 'Expand industry filters for wider reach'
          ].filter(Boolean)
        }
      };
      
      res.json(response);
    } catch (error: any) {
      console.error("Error searching prospects:", error);
      res.status(500).json({ 
        message: "Failed to search prospects",
        error: error.message 
      });
    }
  });

  app.get('/api/prospects', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const filters = req.query;
      const prospects = await storage.getProspects(userId, filters);
      res.json(prospects);
    } catch (error) {
      console.error("Error fetching prospects:", error);
      res.status(500).json({ message: "Failed to fetch prospects" });
    }
  });

  app.get('/api/prospects/:id', 
    isAuthenticatedLocal, 
    cacheProspectData(),
    async (req: any, res) => {
    try {
      const prospect = await storage.getProspect(req.params.id);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error) {
      console.error("Error fetching prospect:", error);
      res.status(500).json({ message: "Failed to fetch prospect" });
    }
  });

  app.post('/api/prospects', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const prospectData = insertProspectSchema.parse({ ...req.body, userId });
      const prospect = await storage.createProspect(prospectData);
      res.json(prospect);
    } catch (error) {
      console.error("Error creating prospect:", error);
      res.status(500).json({ message: "Failed to create prospect" });
    }
  });

  app.put('/api/prospects/:id', 
    isAuthenticatedLocal, 
    invalidateUserCache(),
    async (req: any, res) => {
    try {
      const prospect = await storage.updateProspect(req.params.id, req.body);
      res.json(prospect);
    } catch (error) {
      console.error("Error updating prospect:", error);
      res.status(500).json({ message: "Failed to update prospect" });
    }
  });

  app.delete('/api/prospects/:id', 
    isAuthenticatedLocal, 
    invalidateUserCache(),
    async (req: any, res) => {
    try {
      await storage.deleteProspect(req.params.id);
      res.json({ message: "Prospect deleted successfully" });
    } catch (error) {
      console.error("Error deleting prospect:", error);
      res.status(500).json({ message: "Failed to delete prospect" });
    }
  });

  // HIGHEST PRIORITY: AI-Powered Intelligent Prospect Search API with caching
  app.post('/api/prospects/search-ai', 
    isAuthenticatedLocal, 
    cacheSearchResults(),
    async (req: any, res) => {
    try {
      console.log("🔍 AI-powered prospect search request:", req.body);
      
      // Transform request to search criteria
      const searchCriteria = {
        keywords: req.body.keywords,
        industry: req.body.industry,
        companySize: req.body.companySize,
        location: req.body.location,
        advancedFilters: {
          jobTitle: req.body.jobTitles || [],
          technologies: req.body.technologies || [],
          recentHiring: true,
        },
        aiFeatures: {
          enableLookalikeModeling: true,
          predictiveScoring: true,
          intentSignals: ["hiring", "funding", "technology-adoption"],
        },
      };
      
      // Extract page and limit from request body
      const page = req.body.page || 1;
      const limit = req.body.limit || 50;
      
      // Perform AI-powered intelligent search
      const searchResults = await dataAggregationService.intelligentSearch(
        searchCriteria, 
        page, 
        limit
      );
      
      console.log("✅ Search completed successfully:", {
        totalResults: searchResults.totalResults,
        aiInsights: searchResults.aiInsights,
      });
      
      // Transform results to match expected frontend format
      const response = {
        prospects: searchResults.prospects,
        total: searchResults.totalResults,
        hasMore: searchResults.pagination.hasMore,
        aiInsights: searchResults.aiInsights,
      };
      
      res.json(response);
    } catch (error) {
      console.error("❌ Error in AI-powered search:", error);
      res.status(500).json({ 
        message: "Failed to perform intelligent prospect search",
        error: (error as Error).message 
      });
    }
  });

  // Get available search filter options
  app.get('/api/prospects/search/filters', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const filterOptions = prospectSearchService.getFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const campaigns = await storage.getCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post('/api/campaigns', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const campaignData = insertCampaignSchema.parse({ ...req.body, userId });
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.put('/api/campaigns/:id', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete('/api/campaigns/:id', isAuthenticatedLocal, async (req: any, res) => {
    try {
      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Campaign Execution routes
  app.post('/api/campaigns/:id/execute', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { channel = 'email', prospectIds, testMode = false } = req.body;
      const campaignId = req.params.id;
      
      console.log(`🚀 Executing campaign ${campaignId} via ${channel}`, {
        prospectCount: prospectIds?.length || 'all',
        testMode
      });
      
      const result = await campaignExecutionService.executeCampaign({
        campaignId,
        prospectIds,
        channel,
        testMode
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error executing campaign:", error);
      res.status(500).json({ 
        message: "Failed to execute campaign",
        error: error.message 
      });
    }
  });

  // Email verification endpoint
  app.post('/api/verify/email', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const result = await emailVerificationService.validateEmail(email);
      const isDeliverable = emailVerificationService.isDeliverable(result);
      const riskLevel = emailVerificationService.getRiskLevel(result);
      
      res.json({
        email,
        isDeliverable,
        riskLevel,
        details: result
      });
    } catch (error: any) {
      console.error("Error verifying email:", error);
      res.status(500).json({ 
        message: "Failed to verify email",
        error: error.message 
      });
    }
  });

  // Batch email verification endpoint
  app.post('/api/verify/emails', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ message: "Emails array is required" });
      }
      
      const results = await emailVerificationService.validateBatch(emails);
      
      res.json({
        total: emails.length,
        results: results.map(({ email, result }) => ({
          email,
          isDeliverable: emailVerificationService.isDeliverable(result),
          riskLevel: emailVerificationService.getRiskLevel(result),
          status: result.status
        }))
      });
    } catch (error: any) {
      console.error("Error verifying emails:", error);
      res.status(500).json({ 
        message: "Failed to verify emails",
        error: error.message 
      });
    }
  });

  // Communication status endpoint
  app.get('/api/communication/status', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const twilioConfigured = communicationService.isConfigured();
      const twilioPhone = communicationService.getPhoneNumber();
      const zeroBounceCreditCheck = await emailVerificationService.getCredits();
      
      res.json({
        twilio: {
          configured: twilioConfigured,
          phoneNumber: twilioPhone ? twilioPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : null
        },
        zerobounce: {
          configured: !!process.env.ZEROBOUNCE_API_KEY,
          credits: zeroBounceCreditCheck
        },
        postmark: {
          ...postmarkService.getConfiguration(),
          serverManager: postmarkServerManager.getConfiguration()
        }
      });
    } catch (error: any) {
      console.error("Error checking communication status:", error);
      res.status(500).json({ 
        message: "Failed to check communication status",
        error: error.message 
      });
    }
  });

  // Message routes
  app.get('/api/messages', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageData = insertMessageSchema.parse({ ...req.body, userId });
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Generate personalized message using AI
  app.post('/api/messages/generate', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { prospect, campaignContext, messageOptions } = req.body;

      if (!prospect || !campaignContext || !messageOptions) {
        return res.status(400).json({ 
          message: "Missing required fields: prospect, campaignContext, or messageOptions" 
        });
      }

      // Generate personalized message using new MessageGenerationService
      const messageRequest = {
        prospect,
        campaignContext,
        messageOptions: {
          ...messageOptions,
          templateType: messageOptions.templateType || "cold-email"
        }
      };
      
      // Check if Python AI service is available
      const isHealthy = await pythonAI.healthCheck();
      
      let result;
      if (isHealthy) {
        // Use Python AI service (preferred)
        console.log("🐍 Using Python FastAPI AI service");
        const pythonRequest = {
          prospect,
          campaign_context: campaignContext,
          message_options: messageOptions,
          user_id: userId
        };

        const pythonResult = await pythonAI.generateMessage(pythonRequest);
        
        // Transform Python response to match expected format
        result = {
          id: pythonResult.id,
          subject: pythonResult.variants?.[0]?.subject || "",
          body: pythonResult.variants?.[0]?.content || "",
          personalizationScore: pythonResult.variants?.[0]?.personalization_score || 0.5,
          aiConfidence: pythonResult.variants?.[0]?.confidence || 0.5,
          metadata: pythonResult.metadata,
          variants: pythonResult.variants || [],
        };
      } else {
        // Fallback to TypeScript AI service
        console.warn("⚠️ Python AI service unavailable, using TypeScript fallback");
        result = await messageGenerationService.generateMessage({
          ...messageRequest,
          templateType: messageOptions.templateType || 'cold-email'
        });
      }

      // Save the main message to database (only if we have a valid prospect ID)
      let savedMessage = null;
      if (prospect.id) {
        try {
          savedMessage = await storage.createMessage({
            userId,
            prospectId: prospect.id,
            type: messageOptions.templateType || "cold-email",
            subject: result.subject || "",
            content: result.body,
            tone: messageOptions.tone || "professional",
            aiGenerated: true,
            variant: "A",
            confidenceScore: result.aiConfidence,
          });
        } catch (error) {
          console.error("Failed to save message to database:", error);
          // Continue without saving - we'll still return the generated message
        }
      }

      res.json({
        id: savedMessage?.id || result.id,
        subject: result.subject,
        body: result.body,
        personalizationScore: result.personalizationScore,
        aiConfidence: result.aiConfidence,
        metadata: result.metadata,
        variants: result.variants || [],
      });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate personalized message" });
    }
  });

  // Campaign prospects routes
  app.get('/api/campaigns/:id/prospects', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const campaignProspects = await storage.getCampaignProspects(req.params.id);
      res.json(campaignProspects);
    } catch (error) {
      console.error("Error fetching campaign prospects:", error);
      res.status(500).json({ message: "Failed to fetch campaign prospects" });
    }
  });

  app.post('/api/campaigns/:id/prospects', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { prospectIds } = req.body;
      const campaignId = req.params.id;

      const campaignProspects = [];
      for (const prospectId of prospectIds) {
        const campaignProspect = await storage.createCampaignProspect({
          campaignId,
          prospectId,
          status: "pending",
        });
        campaignProspects.push(campaignProspect);
      }

      // Update campaign prospect count
      await storage.updateCampaign(campaignId, {
        totalProspects: prospectIds.length,
      });

      res.json(campaignProspects);
    } catch (error) {
      console.error("Error adding prospects to campaign:", error);
      res.status(500).json({ message: "Failed to add prospects to campaign" });
    }
  });

  // AI-powered prospect enrichment
  app.post('/api/prospects/:id/enrich', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const prospectId = req.params.id;
      const prospect = await storage.getProspect(prospectId);
      
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Use AI to enrich prospect data
      const enrichmentResult = await aiService.enrichProspectData({
        name: prospect.name,
        company: prospect.company || undefined,
        email: prospect.email || undefined,
        title: prospect.title || undefined,
      });

      // Analyze prospect priority
      const priorityAnalysis = await aiService.analyzeProspectPriority({
        name: prospect.name || "",
        company: prospect.company || "",
        title: prospect.title || "",
        industry: prospect.industry || "",
        recentNews: enrichmentResult.enrichedData.recentNews || undefined,
      });

      // Update prospect with enriched data
      const updatedProspect = await storage.updateProspect(prospectId, {
        industry: enrichmentResult.enrichedData.industry || prospect.industry,
        location: enrichmentResult.enrichedData.location || prospect.location,
        phone: enrichmentResult.enrichedData.phone || prospect.phone,
        linkedinUrl: enrichmentResult.enrichedData.linkedinUrl || prospect.linkedinUrl,
        dataQuality: Math.round(enrichmentResult.confidence * 100),
        verified: enrichmentResult.confidence > 0.7,
        notes: priorityAnalysis.reasoning,
      });

      res.json({
        prospect: updatedProspect,
        enrichmentData: enrichmentResult.enrichedData,
        confidence: enrichmentResult.confidence,
        priorityAnalysis,
      });
    } catch (error) {
      console.error("Error enriching prospect:", error as Error);
      res.status(500).json({ message: "Failed to enrich prospect data" });
    }
  });

  // Batch enrich multiple prospects
  app.post('/api/prospects/enrich-batch', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { prospectIds } = req.body;
      const enrichedProspects = [];

      for (const prospectId of prospectIds.slice(0, 10)) { // Limit to 10 to avoid API rate limits
        try {
          const prospect = await storage.getProspect(prospectId);
          if (!prospect) continue;

          const enrichmentResult = await aiService.enrichProspectData({
            name: prospect.name,
            company: prospect.company || undefined,
            email: prospect.email || undefined,
            title: prospect.title || undefined,
          });

          const updatedProspect = await storage.updateProspect(prospectId, {
            industry: enrichmentResult.enrichedData.industry || prospect.industry,
            location: enrichmentResult.enrichedData.location || prospect.location,
            phone: enrichmentResult.enrichedData.phone || prospect.phone,
            linkedinUrl: enrichmentResult.enrichedData.linkedinUrl || prospect.linkedinUrl,
            dataQuality: Math.round(enrichmentResult.confidence * 100),
            verified: enrichmentResult.confidence > 0.7,
          });

          enrichedProspects.push(updatedProspect);
        } catch (error) {
          console.error(`Error enriching prospect ${prospectId}:`, error);
          // Continue with other prospects even if one fails
        }
      }

      res.json({ enrichedProspects, count: enrichedProspects.length });
    } catch (error) {
      console.error("Error in batch enrichment:", error as Error);
      res.status(500).json({ message: "Failed to enrich prospects" });
    }
  });

  // Analytics routes
  app.get('/api/analytics', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const filters = req.query;
      const analytics = await storage.getAnalytics(userId, filters);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Health check endpoint for CI/CD monitoring
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected', // You can add actual DB health check here
      services: {
        apollo: !!process.env.APOLLO_API_KEY,
        twilio: !!process.env.TWILIO_ACCOUNT_SID,
        openrouter: !!process.env.OPENROUTER_API_KEY,
      }
    });
  });

  // Admin routes for Python AI service monitoring
  app.get('/api/admin/dashboard', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const isHealthy = await pythonAI.healthCheck();
      
      if (isHealthy) {
        const dashboardData = await pythonAI.getAdminDashboard();
        res.json(dashboardData);
      } else {
        // Return empty dashboard if Python service is down
        res.json({
          total_prompts: 0,
          prompts_today: 0,
          average_execution_time: 0,
          top_models: [],
          recent_prompts: [],
          error_rate: 0,
          total_tokens_used: 0
        });
      }
    } catch (error: any) {
      console.error("Error fetching admin dashboard:", error);
      res.status(500).json({ 
        message: "Failed to fetch admin dashboard",
        error: error.message 
      });
    }
  });

  app.get('/api/admin/prompts', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const isHealthy = await pythonAI.healthCheck();
      
      if (isHealthy) {
        const promptLogs = await pythonAI.getPromptLogs(req.query);
        res.json(promptLogs);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("Error fetching prompt logs:", error);
      res.status(500).json({ 
        message: "Failed to fetch prompt logs",
        error: error.message 
      });
    }
  });

  app.get('/api/admin/analytics', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const isHealthy = await pythonAI.healthCheck();
      
      if (isHealthy) {
        const analytics = await pythonAI.getUsageAnalytics(days);
        res.json(analytics);
      } else {
        res.json({
          period: {
            start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString(),
            days
          },
          daily_stats: [],
          prompt_types: [],
          model_usage: []
        });
      }
    } catch (error: any) {
      console.error("Error fetching usage analytics:", error);
      res.status(500).json({ 
        message: "Failed to fetch usage analytics",
        error: error.message 
      });
    }
  });

  // Postmark Server Management API Routes
  app.post('/api/postmark/server/create', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { serverName, serverConfig } = req.body;
      
      console.log(`🚀 Creating Postmark server for user ${userId}:`, serverName);

      const result = await postmarkServerManager.createServerForUser(userId, {
        name: serverName || `${userId.substring(0, 8)} Lead Generation Server`,
        color: 'blue',
        trackOpens: true,
        trackLinks: 'HtmlAndText',
        ...serverConfig
      });

      if (result.success) {
        console.log(`✅ Postmark server created successfully for user ${userId}`);
        
        // Clear cached client to force refresh
        postmarkService.clearUserClient(userId);
        
        res.json({
          success: true,
          server: result.server,
          message: 'Postmark server created successfully'
        });
      } else {
        console.error(`❌ Failed to create Postmark server for user ${userId}:`, result.error);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error("❌ Error creating Postmark server:", error);
      res.status(500).json({ 
        message: "Failed to create Postmark server",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/postmark/server/status', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const serverConfig = await postmarkServerManager.getUserServerConfig(userId);
      const user = await storage.getUser(userId);
      
      res.json({
        hasServer: !!serverConfig,
        server: serverConfig ? {
          id: serverConfig.id,
          name: serverConfig.name,
          createdAt: user?.postmarkServerCreatedAt,
          fromEmail: user?.postmarkFromEmail,
          fromName: user?.postmarkFromName
        } : null,
        capabilities: postmarkServerManager.getConfiguration()
      });
    } catch (error) {
      console.error("❌ Error checking Postmark server status:", error);
      res.status(500).json({ 
        message: "Failed to check server status",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/postmark/server/auto-create', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🤖 Auto-creating Postmark server for user ${userId}`);

      const result = await postmarkServerManager.autoCreateServerForUser(userId);

      if (result.success) {
        console.log(`✅ Auto-created Postmark server for user ${userId}`);
        
        // Clear cached client to force refresh
        postmarkService.clearUserClient(userId);
        
        res.json({
          success: true,
          server: result.server,
          message: 'Postmark server auto-created successfully'
        });
      } else {
        console.error(`❌ Failed to auto-create Postmark server for user ${userId}:`, result.error);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error("❌ Error auto-creating Postmark server:", error);
      res.status(500).json({ 
        message: "Failed to auto-create Postmark server",
        error: (error as Error).message 
      });
    }
  });

  app.patch('/api/postmark/server/config', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fromEmail, fromName, serverName } = req.body;

      // Update user's email configuration
      const updateData: Partial<any> = {};
      if (fromEmail) updateData.postmarkFromEmail = fromEmail;
      if (fromName) updateData.postmarkFromName = fromName;

      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(userId, updateData);
        
        // Clear cached client to force refresh
        postmarkService.clearUserClient(userId);
      }

      // Update server name if provided
      if (serverName) {
        const result = await postmarkServerManager.updateServerConfig(userId, {
          name: serverName
        });

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error
          });
        }
      }

      console.log(`✅ Updated Postmark configuration for user ${userId}`);
      
      res.json({
        success: true,
        message: 'Postmark configuration updated successfully'
      });
    } catch (error) {
      console.error("❌ Error updating Postmark configuration:", error);
      res.status(500).json({ 
        message: "Failed to update Postmark configuration",
        error: (error as Error).message 
      });
    }
  });

  app.delete('/api/postmark/server', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🗑️ Deleting Postmark server for user ${userId}`);

      const result = await postmarkServerManager.deleteUserServer(userId);

      if (result.success) {
        console.log(`✅ Deleted Postmark server for user ${userId}`);
        
        // Clear cached client
        postmarkService.clearUserClient(userId);
        
        res.json({
          success: true,
          message: 'Postmark server deleted successfully'
        });
      } else {
        console.error(`❌ Failed to delete Postmark server for user ${userId}:`, result.error);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error("❌ Error deleting Postmark server:", error);
      res.status(500).json({ 
        message: "Failed to delete Postmark server",
        error: (error as Error).message 
      });
    }
  });

  // Multi-Source Data Integration API Routes
  app.post('/api/prospects/enrich', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { prospectIds, forceRefresh = false } = req.body;
      
      if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
        return res.status(400).json({ message: "Prospect IDs array is required" });
      }

      console.log(`🔄 Enriching ${prospectIds.length} prospects for user ${userId}`);

      // Get prospects from database
      const prospects = [];
      for (const id of prospectIds) {
        const prospect = await storage.getProspect(id);
        if (prospect && prospect.userId === userId) {
          prospects.push(prospect);
        }
      }

      if (prospects.length === 0) {
        return res.status(404).json({ message: "No prospects found" });
      }

      // Process through multi-source pipeline
      const { multiSourceDataPipeline } = await import('./services/multiSourceDataPipeline');
      const result = await multiSourceDataPipeline.processProspects(prospects, userId);

      console.log(`✅ Enrichment completed for ${prospectIds.length} prospects`);

      res.json({
        success: true,
        enriched: result.processed.length,
        duplicates: result.duplicates,
        qualityStats: result.qualityStats,
        message: `Successfully enriched ${result.processed.length} prospects`
      });
    } catch (error) {
      console.error("❌ Error enriching prospects:", error);
      res.status(500).json({ 
        message: "Failed to enrich prospects",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/prospects/quality-stats', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get all prospects for user
      const allProspects = await storage.getProspectsByUserId(userId);
      
      // Calculate quality statistics
      const stats = {
        total: allProspects.length,
        withMultipleSources: allProspects.filter((p: any) => p.dataSources && p.dataSources.length > 1).length,
        averageQuality: allProspects.reduce((sum: number, p: any) => sum + (p.dataQuality || 0), 0) / allProspects.length,
        verified: allProspects.filter((p: any) => p.isVerified).length,
        duplicates: allProspects.filter((p: any) => !p.masterRecord).length,
        sourceBreakdown: {
          apollo: allProspects.filter((p: any) => p.dataSources?.includes('apollo')).length,
          zoominfo: allProspects.filter((p: any) => p.dataSources?.includes('zoominfo')).length,
          hunter: allProspects.filter((p: any) => p.dataSources?.includes('hunter')).length
        },
        qualityDistribution: {
          high: allProspects.filter((p: any) => (p.dataQuality || 0) >= 80).length,
          medium: allProspects.filter((p: any) => (p.dataQuality || 0) >= 50 && (p.dataQuality || 0) < 80).length,
          low: allProspects.filter((p: any) => (p.dataQuality || 0) < 50).length
        }
      };

      res.json(stats);
    } catch (error) {
      console.error("❌ Error getting quality stats:", error);
      res.status(500).json({ 
        message: "Failed to get quality stats",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/data-sources/status', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { multiSourceDataPipeline } = await import('./services/multiSourceDataPipeline');
      const stats = multiSourceDataPipeline.getStatistics();
      
      const status = {
        apollo: {
          available: !!process.env.APOLLO_API_KEY,
          configured: stats.capabilities.apollo,
          status: stats.capabilities.apollo ? 'active' : 'inactive'
        },
        zoominfo: {
          available: !!process.env.ZOOMINFO_API_KEY,
          configured: stats.capabilities.zoominfo,
          status: stats.capabilities.zoominfo ? 'active' : 'inactive'
        },
        hunter: {
          available: !!process.env.HUNTER_API_KEY,
          configured: stats.capabilities.hunter,
          status: stats.capabilities.hunter ? 'active' : 'inactive'
        },
        capabilities: stats.capabilities,
        activeSources: stats.availableSources
      };

      res.json(status);
    } catch (error) {
      console.error("❌ Error getting data source status:", error);
      res.status(500).json({ 
        message: "Failed to get data source status",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/prospects/deduplicate', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🔄 Starting deduplication for user ${userId}`);

      // Get all prospects for user
      const allProspects = await storage.getProspectsByUserId(userId);
      
      if (allProspects.length === 0) {
        return res.json({
          success: true,
          message: 'No prospects to deduplicate',
          result: {
            totalProcessed: 0,
            duplicatesFound: 0,
            duplicatesRemoved: 0,
            masterRecordsCreated: 0,
            qualityImprovements: 0
          }
        });
      }

      // Process through multi-source pipeline for deduplication
      const { multiSourceDataPipeline } = await import('./services/multiSourceDataPipeline');
      const result = await multiSourceDataPipeline.processProspects(allProspects, userId);

      console.log(`✅ Deduplication completed for user ${userId}:`, result.duplicates);

      res.json({
        success: true,
        message: `Deduplication completed. Found ${result.duplicates.duplicatesFound} duplicates.`,
        result: result.duplicates,
        qualityStats: result.qualityStats
      });
    } catch (error) {
      console.error("❌ Error during deduplication:", error);
      res.status(500).json({ 
        message: "Failed to deduplicate prospects",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/prospects/:id/sources', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const prospectId = req.params.id;
      
      if (!userId || !prospectId) {
        return res.status(400).json({ message: "User ID and Prospect ID are required" });
      }

      const prospect = await storage.getProspect(prospectId);
      
      if (!prospect || prospect.userId !== userId) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Return detailed source attribution
      const sourceDetails = {
        id: prospect.id,
        dataSources: prospect.dataSources || [],
        dataQualityBreakdown: prospect.dataQualityBreakdown || {},
        sourceAttribution: prospect.sourceAttribution || {},
        lastEnriched: prospect.lastEnriched,
        isVerified: prospect.isVerified,
        masterRecord: prospect.masterRecord,
        duplicateOf: prospect.duplicateOf,
        mergedRecords: prospect.mergedRecords || [],
        qualityScore: prospect.dataQuality,
        enrichmentHistory: {
          apollo: prospect.dataSources?.includes('apollo') ? 'enriched' : 'not_enriched',
          zoominfo: prospect.dataSources?.includes('zoominfo') ? 'enriched' : 'not_enriched',
          hunter: prospect.dataSources?.includes('hunter') ? 'enriched' : 'not_enriched'
        }
      };

      res.json(sourceDetails);
    } catch (error) {
      console.error("❌ Error getting prospect sources:", error);
      res.status(500).json({ 
        message: "Failed to get prospect sources",
        error: (error as Error).message 
      });
    }
  });

  // User API Keys Management Routes
  app.get('/api/user/api-keys', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return API key status (masked keys for security)
      const apiKeys = [
        {
          service: 'apollo',
          name: 'Apollo.io',
          key: user.apolloApiKey ? maskApiKey(user.apolloApiKey) : '',
          status: user.apolloApiKey ? 'active' : 'inactive',
          lastVerified: user.apiKeysUpdatedAt?.toISOString() || ''
        },
        {
          service: 'zoominfo',
          name: 'ZoomInfo',
          key: user.zoomInfoApiKey ? maskApiKey(user.zoomInfoApiKey) : '',
          status: user.zoomInfoApiKey ? 'active' : 'inactive',
          lastVerified: user.apiKeysUpdatedAt?.toISOString() || ''
        },
        {
          service: 'hunter',
          name: 'Hunter.io',
          key: user.hunterApiKey ? maskApiKey(user.hunterApiKey) : '',
          status: user.hunterApiKey ? 'active' : 'inactive',
          lastVerified: user.apiKeysUpdatedAt?.toISOString() || ''
        }
      ].filter(key => key.key); // Only return configured keys

      res.json(apiKeys);
    } catch (error) {
      console.error("❌ Error fetching API keys:", error);
      res.status(500).json({ 
        message: "Failed to fetch API keys",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/user/api-keys', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { service, key } = req.body;
      
      if (!service || !key) {
        return res.status(400).json({ message: "Service and API key are required" });
      }

      // Validate service
      const validServices = ['apollo', 'zoominfo', 'hunter'];
      if (!validServices.includes(service)) {
        return res.status(400).json({ message: "Invalid service" });
      }

      // Test the API key before saving
      const isValid = await testApiKey(service, key);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired API key" });
      }

      // Update user with new API key
      const updates: any = {
        apiKeysUpdatedAt: new Date()
      };

      switch (service) {
        case 'apollo':
          updates.apolloApiKey = key;
          break;
        case 'zoominfo':
          updates.zoomInfoApiKey = key;
          break;
        case 'hunter':
          updates.hunterApiKey = key;
          break;
      }

      await storage.updateUser(userId, updates);

      console.log(`✅ API key saved for user ${userId}: ${service}`);

      res.json({
        success: true,
        message: `${service} API key saved successfully`,
        service,
        status: 'active'
      });
    } catch (error) {
      console.error("❌ Error saving API key:", error);
      res.status(500).json({ 
        message: "Failed to save API key",
        error: (error as Error).message 
      });
    }
  });

  app.delete('/api/user/api-keys/:service', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { service } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validServices = ['apollo', 'zoominfo', 'hunter'];
      if (!validServices.includes(service)) {
        return res.status(400).json({ message: "Invalid service" });
      }

      // Remove API key
      const updates: any = {
        apiKeysUpdatedAt: new Date()
      };

      switch (service) {
        case 'apollo':
          updates.apolloApiKey = null;
          break;
        case 'zoominfo':
          updates.zoomInfoApiKey = null;
          break;
        case 'hunter':
          updates.hunterApiKey = null;
          break;
      }

      await storage.updateUser(userId, updates);

      console.log(`🗑️ API key deleted for user ${userId}: ${service}`);

      res.json({
        success: true,
        message: `${service} API key deleted successfully`
      });
    } catch (error) {
      console.error("❌ Error deleting API key:", error);
      res.status(500).json({ 
        message: "Failed to delete API key",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/user/api-keys/:service/test', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { service } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get API key for service
      let apiKey = '';
      switch (service) {
        case 'apollo':
          apiKey = user.apolloApiKey || '';
          break;
        case 'zoominfo':
          apiKey = user.zoomInfoApiKey || '';
          break;
        case 'hunter':
          apiKey = user.hunterApiKey || '';
          break;
        default:
          return res.status(400).json({ message: "Invalid service" });
      }

      if (!apiKey) {
        return res.status(404).json({ message: "API key not found for service" });
      }

      // Test the API key
      const isValid = await testApiKey(service, apiKey);
      
      if (isValid) {
        // Update last verified timestamp
        await storage.updateUser(userId, { apiKeysUpdatedAt: new Date() });
        
        res.json({
          success: true,
          message: `${service} API key is valid and working`,
          status: 'active'
        });
      } else {
        res.status(400).json({
          success: false,
          message: `${service} API key test failed`,
          status: 'error'
        });
      }
    } catch (error) {
      console.error("❌ Error testing API key:", error);
      res.status(500).json({ 
        message: "Failed to test API key",
        error: (error as Error).message 
      });
    }
  });

  // CARD-032: Multi-Channel Campaign Orchestration Routes
  app.post('/api/campaigns/:id/orchestration/initialize', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      const config = req.body;
      
      const { campaignOrchestrationEngine } = await import('./services/campaignOrchestrationEngine');
      await campaignOrchestrationEngine.initializeCampaign({ ...config, campaignId });
      
      res.json({
        success: true,
        message: "Campaign orchestration initialized successfully",
        campaignId
      });
    } catch (error) {
      console.error("❌ Error initializing campaign orchestration:", error);
      res.status(500).json({ 
        message: "Failed to initialize campaign orchestration",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/campaigns/:id/performance', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      
      const { campaignOrchestrationEngine } = await import('./services/campaignOrchestrationEngine');
      const performance = await campaignOrchestrationEngine.getCampaignPerformance(campaignId);
      
      res.json(performance);
    } catch (error) {
      console.error("❌ Error getting campaign performance:", error);
      res.status(500).json({ 
        message: "Failed to get campaign performance",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/campaigns/:id/optimize', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      
      const { campaignOrchestrationEngine } = await import('./services/campaignOrchestrationEngine');
      const result = await campaignOrchestrationEngine.optimizeCampaign(campaignId);
      
      res.json(result);
    } catch (error) {
      console.error("❌ Error optimizing campaign:", error);
      res.status(500).json({ 
        message: "Failed to optimize campaign",
        error: (error as Error).message 
      });
    }
  });

  // Campaign Sequence Management Routes
  app.get('/api/sequence-templates', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { industry, useCase } = req.query;
      
      const { campaignSequenceManager } = await import('./services/campaignSequenceManager');
      const templates = campaignSequenceManager.getSequenceTemplates({ industry, useCase });
      
      res.json(templates);
    } catch (error) {
      console.error("❌ Error getting sequence templates:", error);
      res.status(500).json({ 
        message: "Failed to get sequence templates",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/campaigns/:id/sequence/apply-template', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      const { templateId } = req.body;
      
      const { campaignSequenceManager } = await import('./services/campaignSequenceManager');
      const config = await campaignSequenceManager.applySequenceTemplate(campaignId, templateId);
      
      res.json({
        success: true,
        message: "Sequence template applied successfully",
        config
      });
    } catch (error) {
      console.error("❌ Error applying sequence template:", error);
      res.status(500).json({ 
        message: "Failed to apply sequence template",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/campaigns/:id/sequence/custom', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      const { steps } = req.body;
      
      const { campaignSequenceManager } = await import('./services/campaignSequenceManager');
      const sequence = await campaignSequenceManager.createCustomSequence(campaignId, steps);
      
      res.json({
        success: true,
        message: "Custom sequence created successfully",
        sequence
      });
    } catch (error) {
      console.error("❌ Error creating custom sequence:", error);
      res.status(500).json({ 
        message: "Failed to create custom sequence",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/campaigns/:id/sequence/analytics', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      
      const { campaignSequenceManager } = await import('./services/campaignSequenceManager');
      const analytics = await campaignSequenceManager.getSequenceAnalytics(campaignId);
      
      res.json(analytics);
    } catch (error) {
      console.error("❌ Error getting sequence analytics:", error);
      res.status(500).json({ 
        message: "Failed to get sequence analytics",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/campaigns/:id/automation/rules', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { id: campaignId } = req.params;
      const rule = req.body;
      
      const { campaignSequenceManager } = await import('./services/campaignSequenceManager');
      const createdRule = await campaignSequenceManager.createAutomationRule(campaignId, rule);
      
      res.json({
        success: true,
        message: "Automation rule created successfully",
        rule: createdRule
      });
    } catch (error) {
      console.error("❌ Error creating automation rule:", error);
      res.status(500).json({ 
        message: "Failed to create automation rule",
        error: (error as Error).message 
      });
    }
  });

  // Process scheduled campaign actions (would be called by a scheduler)
  app.post('/api/campaigns/process-scheduled-actions', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { campaignOrchestrationEngine } = await import('./services/campaignOrchestrationEngine');
      await campaignOrchestrationEngine.processScheduledActions();
      
      res.json({
        success: true,
        message: "Scheduled actions processed successfully"
      });
    } catch (error) {
      console.error("❌ Error processing scheduled actions:", error);
      res.status(500).json({ 
        message: "Failed to process scheduled actions",
        error: (error as Error).message 
      });
    }
  });

  // CARD-036: Email Delivery System Routes
  app.post('/api/email-delivery/initialize', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const config = req.body;
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      await emailDeliverySystem.initialize(config);
      
      res.json({
        success: true,
        message: "Email delivery system initialized successfully"
      });
    } catch (error) {
      console.error("❌ Error initializing email delivery system:", error);
      res.status(500).json({ 
        message: "Failed to initialize email delivery system",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/email-delivery/send-optimized', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const params = {
        ...req.body,
        userId: req.user?.claims?.sub || req.user?.id
      };
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      const result = await emailDeliverySystem.sendOptimizedEmail(params);
      
      res.json(result);
    } catch (error) {
      console.error("❌ Error sending optimized email:", error);
      res.status(500).json({ 
        message: "Failed to send optimized email",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/email-delivery/metrics/:userId', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { campaignId } = req.query;
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      const metrics = await emailDeliverySystem.getDeliveryMetrics(userId, campaignId);
      
      res.json(metrics);
    } catch (error) {
      console.error("❌ Error getting delivery metrics:", error);
      res.status(500).json({ 
        message: "Failed to get delivery metrics",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/email-delivery/health-report/:userId', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      const report = await emailDeliverySystem.generateDeliveryHealthReport(userId);
      
      res.json(report);
    } catch (error) {
      console.error("❌ Error generating delivery health report:", error);
      res.status(500).json({ 
        message: "Failed to generate delivery health report",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/email-delivery/handle-bounce', async (req: any, res) => {
    try {
      const bounceData = req.body;
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      await emailDeliverySystem.handleBounce(bounceData);
      
      res.json({
        success: true,
        message: "Bounce handled successfully"
      });
    } catch (error) {
      console.error("❌ Error handling bounce:", error);
      res.status(500).json({ 
        message: "Failed to handle bounce",
        error: (error as Error).message 
      });
    }
  });

  app.post('/api/email-delivery/handle-complaint', async (req: any, res) => {
    try {
      const complaintData = req.body;
      
      const { emailDeliverySystem } = await import('./services/emailDeliverySystem');
      await emailDeliverySystem.handleComplaint(complaintData);
      
      res.json({
        success: true,
        message: "Complaint handled successfully"
      });
    } catch (error) {
      console.error("❌ Error handling complaint:", error);
      res.status(500).json({ 
        message: "Failed to handle complaint",
        error: (error as Error).message 
      });
    }
  });

  // ===================
  // LINKEDIN MESSAGING API ROUTES
  // ===================

  // Generate LinkedIn connection request
  app.post('/api/linkedin/connection-request', isAuthenticatedLocal, async (req, res) => {
    try {
      const { prospectId, campaignContext } = req.body;
      const userId = req.user.id;
      
      const prospect = await storage.getProspect(prospectId);
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      if (prospect.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const connectionMessage = await linkedinMessagingService.generateConnectionRequest(
        prospect,
        campaignContext || {}
      );
      
      res.json(connectionMessage);
    } catch (error: any) {
      console.error('Error generating LinkedIn connection request:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate LinkedIn follow-up message
  app.post('/api/linkedin/follow-up', isAuthenticatedLocal, async (req, res) => {
    try {
      const { prospectId, campaignContext, previousInteraction } = req.body;
      const userId = req.user.id;
      
      const prospect = await storage.getProspect(prospectId);
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      if (prospect.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const followUpMessage = await linkedinMessagingService.generateFollowUpMessage(
        prospect,
        campaignContext || {},
        previousInteraction
      );
      
      res.json(followUpMessage);
    } catch (error: any) {
      console.error('Error generating LinkedIn follow-up:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record LinkedIn interaction
  app.post('/api/linkedin/record-interaction', isAuthenticatedLocal, async (req, res) => {
    try {
      const { campaignId, interaction } = req.body;
      const userId = req.user.id;
      
      // Validate interaction data
      if (!campaignId || !interaction || !interaction.prospectId || !interaction.interactionType) {
        return res.status(400).json({ error: 'Missing required interaction data' });
      }
      
      await linkedinMessagingService.recordInteraction(userId, campaignId, interaction);
      
      res.json({ success: true, message: 'Interaction recorded successfully' });
    } catch (error: any) {
      console.error('Error recording LinkedIn interaction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get LinkedIn campaign metrics
  app.get('/api/linkedin/campaign/:campaignId/metrics', isAuthenticatedLocal, async (req, res) => {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      
      // Verify user owns the campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const metrics = await linkedinMessagingService.getCampaignMetrics(campaignId);
      
      res.json(metrics || {
        campaignId,
        totalPrepared: 0,
        connectionRequestsSent: 0,
        messagesResponseRate: 0,
        connectionAcceptanceRate: 0,
        meetingRequests: 0,
        positiveReplies: 0,
        totalEngagement: 0,
        lastUpdated: new Date()
      });
    } catch (error: any) {
      console.error('Error getting LinkedIn campaign metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get LinkedIn rate limit status
  app.get('/api/linkedin/rate-limits', isAuthenticatedLocal, async (req, res) => {
    try {
      const userId = req.user.id;
      
      const rateLimits = await linkedinMessagingService.getRateLimitStatus(userId);
      
      res.json(rateLimits);
    } catch (error: any) {
      console.error('Error getting LinkedIn rate limits:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get LinkedIn compliance guidelines
  app.get('/api/linkedin/compliance', isAuthenticatedLocal, async (req, res) => {
    try {
      const guidelines = linkedinMessagingService.getComplianceGuidelines();
      
      res.json(guidelines);
    } catch (error: any) {
      console.error('Error getting LinkedIn compliance guidelines:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Setup API Gateway management routes
  setupApiGatewayRoutes(app);

  // Setup cache management routes
  setupCacheRoutes(app);

  // Setup email verification routes (CARD-013)
  setupEmailVerificationRoutes(app);

  // Setup search analytics routes (CARD-025)
  app.use('/api/search-analytics', isAuthenticatedLocal, searchAnalyticsRoutes);
  console.log("🔧 Search analytics routes configured");

  // Setup context analysis routes (CARD-028)
  app.use('/api/context-analysis', isAuthenticatedLocal, contextAnalysisRoutes);
  console.log("🔧 Context analysis routes configured");
  
  // Setup message optimization routes (CARD-029)
  app.use('/api/message-optimization', isAuthenticatedLocal, messageOptimizationRoutes);
  console.log("🔧 Message optimization routes configured");

  // Setup campaign scheduling routes (CARD-033)
  app.use('/api/campaign-scheduling', isAuthenticatedLocal, campaignSchedulingRoutes);
  console.log("🔧 Campaign scheduling routes configured");
  
  // Response Detection routes (CARD-034)
  console.log('🧠 Response detection routes configured');
  app.use('/api/response-detection', isAuthenticatedLocal, responseDetectionRoutes);

  // Deliverability Monitoring routes (CARD-039)
  app.use('/api/deliverability', isAuthenticatedLocal, deliverabilityRoutes);
  console.log('📧 Deliverability monitoring routes configured');

  // CARD-009: Campaign Creation Routes
  try {
    const campaignModule = await import('./routes/campaignCreationRoutes.js');
    campaignModule.registerCampaignCreationRoutes(app);
    console.log('🚀 Campaign creation routes configured');
  } catch (error) {
    console.error('❌ Failed to register campaign creation routes:', error);
  }

  // CARD-010: Email Delivery Engine Routes
  try {
    const emailModule = await import('./routes/emailDeliveryRoutes.js');
    emailModule.registerEmailDeliveryRoutes(app);
    console.log('📬 Email delivery engine routes configured');
  } catch (error) {
    console.error('❌ Failed to register email delivery routes:', error);
  }

  // CARD-013: API Rate Limiting and Cost Optimization Routes
  try {
    const rateLimitingModule = await import('./routes/apiRateLimitingRoutes.js');
    rateLimitingModule.registerApiRateLimitingRoutes(app);
    console.log('🛡️ API rate limiting and cost optimization routes configured');
  } catch (error) {
    console.error('❌ Failed to register API rate limiting routes:', error);
  }

  // CARD-007: Prospect Search Engine Routes
  try {
    const searchModule = await import('./routes/prospectSearchRoutes.js');
    searchModule.registerProspectSearchRoutes(app);
    console.log('🔍 Prospect search engine routes configured');
  } catch (error) {
    console.error('❌ Failed to register prospect search routes:', error);
  }

  // CARD-007: Test Routes (Development Only)
  try {
    const testModule = await import('./routes/prospectSearchTestRoutes.js');
    testModule.registerProspectSearchTestRoutes(app);
    console.log('🧪 Prospect search test routes configured');
  } catch (error) {
    console.error('❌ Failed to register prospect search test routes:', error);
  }

  const httpServer = createServer(app);
  return httpServer;
}
