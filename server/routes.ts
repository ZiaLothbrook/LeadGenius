import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth, createAdminUser } from "./localAuth";
import { z } from "zod";
import { aiService } from "./services/aiService";
import { prospectSearchService, searchFiltersSchema } from "./services/prospectSearchService";
import { dataAggregationService } from "./services/dataAggregationService";
import {
  insertProspectSchema,
  insertCampaignSchema,
  insertMessageSchema,
  insertCampaignProspectSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  await setupLocalAuth(app);
  
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
      
      // Perform AI-powered intelligent search
      const searchResults = await dataAggregationService.intelligentSearch(searchCriteria);
      
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
      const { prospectId, messageType = "cold_email", tone = "professional", context } = req.body;

      const prospect = await storage.getProspect(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Generate personalized message using OpenRouter
      const messageContent = await aiService.generatePersonalizedMessage(
        {
          name: prospect.name || "there",
          company: prospect.company || "",
          title: prospect.title || "",
          industry: prospect.industry || "",
          location: prospect.location || undefined,
        },
        messageType,
        tone,
        context
      );

      // Generate subject lines
      const subjects = await aiService.generateEmailSubjects({
        name: prospect.name || "there",
        company: prospect.company || "",
        title: prospect.title || "",
      });

      // Save generated message to database
      const message = await storage.createMessage({
        userId,
        prospectId,
        type: messageType,
        subject: subjects[0] || `Re: ${prospect.company}`,
        content: messageContent,
        tone,
        aiGenerated: true,
        variant: "A",
        confidenceScore: 85,
      });

      res.json({
        message,
        alternativeSubjects: subjects.slice(1),
        messageContent,
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

  const httpServer = createServer(app);
  return httpServer;
}
