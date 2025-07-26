import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth, createAdminUser } from "./localAuth";
import { z } from "zod";
import { generatePersonalizedMessage, enrichProspectData } from "./services/openai";
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
      const userId = req.user.claims.sub;
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

  // Enrich prospect data
  app.post('/api/prospects/:id/enrich', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const prospect = await storage.getProspect(req.params.id);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      const enrichedData = await enrichProspectData(prospect);
      const updatedProspect = await storage.updateProspect(req.params.id, {
        ...enrichedData,
        verified: true,
        dataQuality: 95,
      });

      res.json(updatedProspect);
    } catch (error) {
      console.error("Error enriching prospect:", error);
      res.status(500).json({ message: "Failed to enrich prospect data" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { prospectId, campaignGoal, tone, messageType, additionalContext } = req.body;

      const prospect = await storage.getProspect(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      const generatedMessages = await generatePersonalizedMessage({
        prospect,
        campaignGoal,
        tone,
        messageType,
        additionalContext,
      });

      // Save generated messages to database
      const savedMessages = [];
      for (const [index, messageData] of generatedMessages.entries()) {
        const message = await storage.createMessage({
          userId,
          prospectId,
          type: messageType,
          subject: messageData.subject,
          content: messageData.content,
          tone,
          aiGenerated: true,
          variant: String.fromCharCode(65 + index), // A, B, C
          confidenceScore: messageData.confidenceScore,
        });
        savedMessages.push(message);
      }

      res.json(savedMessages);
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

  // Analytics routes
  app.get('/api/analytics', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
