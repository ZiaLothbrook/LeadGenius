import { Router } from "express";
import { contextAnalysisService } from "../services/contextAnalysisService";
import { isAuthenticatedLocal } from "../localAuth";
import { z } from "zod";

const router = Router();

// Validation schemas
const companyIntelligenceSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  description: z.string().optional(),
});

const industryAnalysisSchema = z.object({
  industry: z.string().min(1),
  region: z.string().optional(),
  companySize: z.string().optional(),
});

const contextAnalysisSchema = z.object({
  prospectId: z.string().min(1),
  analysisType: z.enum(['quick', 'comprehensive', 'deep']).optional(),
});

const messageOptimizationSchema = z.object({
  originalMessage: z.string().min(1),
  contextAnalysisId: z.number(),
  optimizationType: z.enum(['tone', 'length', 'structure', 'personalization']),
});

/**
 * CARD-028: Context Analysis API Routes
 * RESTful endpoints for AI-powered context analysis and intelligence gathering
 */

// Company Intelligence Analysis
router.post('/company-intelligence', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = companyIntelligenceSchema.parse(req.body);
    
    const result = await contextAnalysisService.analyzeCompanyIntelligence(
      userId,
      validatedData
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Company intelligence analysis failed:', error);
    res.status(500).json({
      error: 'Failed to analyze company intelligence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Industry Trend Analysis
router.post('/industry-trends', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = industryAnalysisSchema.parse(req.body);
    
    const result = await contextAnalysisService.analyzeIndustryTrends(
      userId,
      validatedData
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Industry trend analysis failed:', error);
    res.status(500).json({
      error: 'Failed to analyze industry trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comprehensive Context Analysis
router.post('/context-analysis', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = contextAnalysisSchema.parse(req.body);
    
    const result = await contextAnalysisService.performContextAnalysis(
      userId,
      validatedData.prospectId,
      validatedData.analysisType
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Context analysis failed:', error);
    res.status(500).json({
      error: 'Failed to perform context analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Context Analysis by ID
router.get('/context-analysis/:id', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const analysisId = parseInt(req.params.id);
    if (isNaN(analysisId)) {
      return res.status(400).json({ error: 'Invalid analysis ID' });
    }

    // This would need to be implemented in the service
    // For now, return a placeholder response
    res.json({
      success: true,
      data: { message: 'Context analysis retrieval not yet implemented' }
    });
  } catch (error) {
    console.error('Get context analysis failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve context analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Personalization Context Generation
router.post('/personalization-context', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { prospectId, contextAnalysisId } = req.body;
    
    if (!prospectId) {
      return res.status(400).json({ error: 'Prospect ID is required' });
    }

    const result = await contextAnalysisService.generatePersonalizationContext(
      userId,
      prospectId,
      contextAnalysisId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Personalization context generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate personalization context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Message Optimization
router.post('/message-optimization', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = messageOptimizationSchema.parse(req.body);
    
    // Need to get the context analysis first
    // This is a simplified implementation
    const mockContextAnalysis = { id: validatedData.contextAnalysisId } as any;
    
    const result = await contextAnalysisService.optimizeMessage(userId, {
      originalMessage: validatedData.originalMessage,
      contextAnalysis: mockContextAnalysis,
      optimizationType: validatedData.optimizationType
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Message optimization failed:', error);
    res.status(500).json({
      error: 'Failed to optimize message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Context Analytics Dashboard
router.get('/dashboard', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const timeRange = req.query.period as string || '7d';
    
    const result = await contextAnalysisService.getContextAnalyticsDashboard(
      userId,
      timeRange
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Context analytics dashboard failed:', error);
    res.status(500).json({
      error: 'Failed to generate context analytics dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Company Profiles
router.get('/company-profiles', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // This would need to be implemented in the service
    res.json({
      success: true,
      data: { message: 'Company profiles listing not yet implemented' }
    });
  } catch (error) {
    console.error('Get company profiles failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve company profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Industry Trends
router.get('/industry-trends', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const industry = req.query.industry as string;
    
    // This would need to be implemented in the service
    res.json({
      success: true,
      data: { message: 'Industry trends listing not yet implemented' }
    });
  } catch (error) {
    console.error('Get industry trends failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve industry trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk Context Analysis
router.post('/bulk-analysis', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { prospectIds, analysisType = 'comprehensive' } = req.body;
    
    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: 'Prospect IDs array is required' });
    }

    // Process bulk analysis (simplified implementation)
    const results = [];
    for (const prospectId of prospectIds.slice(0, 10)) { // Limit to 10 for now
      try {
        const result = await contextAnalysisService.performContextAnalysis(
          userId,
          prospectId,
          analysisType
        );
        results.push(result);
      } catch (error) {
        console.warn(`Context analysis failed for prospect ${prospectId}:`, error);
        results.push({
          prospectId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Bulk context analysis failed:', error);
    res.status(500).json({
      error: 'Failed to perform bulk context analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;