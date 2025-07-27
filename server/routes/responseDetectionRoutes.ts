import { Router } from 'express';
import { z } from 'zod';
import { responseDetectionService } from '../services/responseDetectionService';
import { insertResponseSchema } from '@shared/schema';
import { isAuthenticatedLocal } from '../localAuth';

const router = Router();

// Create response detection record
router.post('/detect', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validationSchema = z.object({
      responseText: z.string().min(1, 'Response text is required'),
      responseType: z.enum(['email', 'linkedin', 'phone', 'chat']),
      responseFrom: z.string().min(1, 'Response from is required'),
      responseTo: z.string().optional(),
      responseSubject: z.string().optional(),
      campaignId: z.string().optional(),
      messageId: z.string().optional(),
      prospectId: z.string().optional(),
      detectionMethod: z.enum(['api_webhook', 'email_parsing', 'manual_input', 'auto_scan']),
      responseTime: z.string().optional().transform(val => val ? new Date(val) : undefined),
      rawData: z.any().optional()
    });

    const data = validationSchema.parse(req.body);
    
    const result = await responseDetectionService.detectResponse({
      ...data,
      userId
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      response: result.response,
      analysis: result.analysis,
      actions: result.actions
    });

  } catch (error: any) {
    console.error('Error detecting response:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get responses with analysis
router.get('/responses', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const querySchema = z.object({
      campaignId: z.string().optional(),
      limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
      offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
      sentimentFilter: z.enum(['positive', 'negative', 'neutral']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });

    const query = querySchema.parse(req.query);
    
    const options: any = {
      campaignId: query.campaignId,
      limit: query.limit,
      offset: query.offset,
      sentimentFilter: query.sentimentFilter
    };

    if (query.startDate && query.endDate) {
      options.dateRange = {
        start: new Date(query.startDate),
        end: new Date(query.endDate)
      };
    }

    const result = await responseDetectionService.getResponsesWithAnalysis(userId, options);

    res.json({
      success: true,
      responses: result.responses,
      total: result.total,
      analytics: result.analytics
    });

  } catch (error: any) {
    console.error('Error getting responses:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get response analytics
router.get('/analytics', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const campaignId = req.query.campaignId as string;
    
    const analytics = await responseDetectionService.getResponseAnalytics(userId, campaignId);

    res.json({
      success: true,
      analytics
    });

  } catch (error: any) {
    console.error('Error getting response analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get optimization insights
router.get('/insights', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const campaignId = req.query.campaignId as string;
    
    const insights = await responseDetectionService.generateOptimizationInsights(userId, campaignId);

    res.json({
      success: true,
      insights
    });

  } catch (error: any) {
    console.error('Error generating optimization insights:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute automated action
router.post('/actions/:actionId/execute', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { actionId } = req.params;
    
    const result = await responseDetectionService.executeAction(actionId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      result: result.result
    });

  } catch (error: any) {
    console.error('Error executing response action:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get response dashboard data
router.get('/dashboard', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const campaignId = req.query.campaignId as string;
    
    // Get recent responses with analysis
    const recentResponses = await responseDetectionService.getResponsesWithAnalysis(userId, {
      campaignId,
      limit: 10,
      offset: 0
    });

    // Get analytics
    const analytics = await responseDetectionService.getResponseAnalytics(userId, campaignId);

    // Get optimization insights
    const insights = await responseDetectionService.generateOptimizationInsights(userId, campaignId);

    res.json({
      success: true,
      dashboard: {
        recentResponses: recentResponses.responses,
        analytics: recentResponses.analytics,
        insights: insights.slice(0, 5), // Top 5 insights
        summary: {
          totalResponses: recentResponses.total,
          positiveResponseRate: analytics.positiveResponseRate,
          averageSentimentScore: analytics.averageSentimentScore,
          pendingActions: 0 // Would be calculated from pending actions
        }
      }
    });

  } catch (error: any) {
    console.error('Error getting response dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual response analysis (for testing/demo)
router.post('/analyze-sample', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validationSchema = z.object({
      responseText: z.string().min(1, 'Response text is required')
    });

    const { responseText } = validationSchema.parse(req.body);
    
    // Create a sample response for analysis
    const sampleResponse = {
      responseText,
      responseType: 'email' as const,
      responseFrom: 'sample@example.com',
      detectionMethod: 'manual_input' as const,
      userId
    };

    const result = await responseDetectionService.detectResponse(sampleResponse);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.analysis,
      sentiment: {
        category: result.analysis?.sentimentCategory,
        score: result.analysis?.sentimentScore,
        confidence: result.analysis?.sentimentConfidence,
        emotionalTone: result.analysis?.emotionalTone
      },
      intent: {
        category: result.analysis?.intentCategory,
        score: result.analysis?.intentScore,
        keyIntents: result.analysis?.keyIntents
      },
      actionRequired: result.analysis?.actionRequired,
      nextBestAction: result.analysis?.nextBestAction,
      aiSummary: result.analysis?.aiSummary,
      recommendations: result.analysis?.aiRecommendations
    });

  } catch (error: any) {
    console.error('Error analyzing sample response:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Bulk response import (for email integrations)
router.post('/bulk-import', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validationSchema = z.object({
      responses: z.array(z.object({
        responseText: z.string().min(1),
        responseType: z.enum(['email', 'linkedin', 'phone', 'chat']),
        responseFrom: z.string().min(1),
        responseTo: z.string().optional(),
        responseSubject: z.string().optional(),
        campaignId: z.string().optional(),
        messageId: z.string().optional(),
        prospectId: z.string().optional(),
        responseTime: z.string().optional(),
        rawData: z.any().optional()
      }))
    });

    const { responses } = validationSchema.parse(req.body);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const responseData of responses) {
      try {
        const result = await responseDetectionService.detectResponse({
          ...responseData,
          detectionMethod: 'api_webhook',
          responseTime: responseData.responseTime ? new Date(responseData.responseTime) : undefined,
          userId
        });

        if (result.success) {
          successCount++;
          results.push({ success: true, responseId: result.response?.id });
        } else {
          errorCount++;
          results.push({ success: false, error: result.error });
        }
      } catch (error: any) {
        errorCount++;
        results.push({ success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      summary: {
        total: responses.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error: any) {
    console.error('Error bulk importing responses:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;