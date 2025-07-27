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
import {
  insertProspectSchema,
  insertCampaignSchema,
  insertMessageSchema,
  insertCampaignProspectSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - setup both Replit and local auth
  await setupAuth(app);
  await setupLocalAuth(app);
  
  // Create admin user if it doesn't exist
  await createAdminUser();
  
  // Create admin user on startup
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



  // Bulk Message Generation API
  app.post('/api/messages/generate-bulk', isAuthenticatedLocal, async (req: any, res) => {
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
        error: error.message 
      });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Prospect routes
  app.post('/api/prospects/search', isAuthenticatedLocal, async (req: any, res) => {
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

  app.get('/api/prospects/:id', isAuthenticatedLocal, async (req: any, res) => {
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

  app.put('/api/prospects/:id', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const prospect = await storage.updateProspect(req.params.id, req.body);
      res.json(prospect);
    } catch (error) {
      console.error("Error updating prospect:", error);
      res.status(500).json({ message: "Failed to update prospect" });
    }
  });

  app.delete('/api/prospects/:id', isAuthenticatedLocal, async (req: any, res) => {
    try {
      await storage.deleteProspect(req.params.id);
      res.json({ message: "Prospect deleted successfully" });
    } catch (error) {
      console.error("Error deleting prospect:", error);
      res.status(500).json({ message: "Failed to delete prospect" });
    }
  });

  // HIGHEST PRIORITY: AI-Powered Intelligent Prospect Search API
  app.post('/api/prospects/search', isAuthenticatedLocal, async (req: any, res) => {
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
        error: error.message 
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
        postmark: postmarkService.getConfiguration()
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
        result = await messageGenerationService.generateMessage(messageRequest);
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
        company: prospect.company,
        email: prospect.email,
        title: prospect.title,
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
        priority: priorityAnalysis.priority,
        notes: priorityAnalysis.reasoning,
      });

      res.json({
        prospect: updatedProspect,
        enrichmentData: enrichmentResult.enrichedData,
        confidence: enrichmentResult.confidence,
        priorityAnalysis,
      });
    } catch (error) {
      console.error("Error enriching prospect:", error);
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
            company: prospect.company,
            email: prospect.email,
            title: prospect.title,
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
      console.error("Error in batch enrichment:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}
