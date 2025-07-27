import { Router } from 'express';
import { messageOptimizationService } from '../services/messageOptimizationService';
import { isAuthenticatedLocal } from '../localAuth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createABTestSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  testType: z.enum(['subject_line', 'content', 'cta', 'tone', 'length', 'timing']),
  hypothesis: z.string().min(1, 'Hypothesis is required'),
  testDescription: z.string().optional(),
  sampleSize: z.number().min(10, 'Sample size must be at least 10'),
  confidenceLevel: z.number().min(90).max(99).default(95),
  minDetectableEffect: z.number().min(1).max(50).default(5),
  trafficSplit: z.record(z.number()).default({ A: 50, B: 50 }),
  plannedDuration: z.number().min(1).max(168).default(24), // 1 hour to 1 week
  campaignId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const createVariantSchema = z.object({
  testId: z.string().min(1, 'Test ID is required'),
  messageId: z.string().min(1, 'Message ID is required'),
  variantName: z.string().min(1, 'Variant name is required'),
  variantType: z.enum(['control', 'treatment']),
  changes: z.record(z.any()),
  changeSummary: z.string().optional(),
});

const trackPerformanceSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  eventType: z.enum(['sent', 'delivered', 'opened', 'clicked', 'replied', 'converted', 'bounced', 'unsubscribed']),
  eventData: z.record(z.any()).optional(),
});

const createOptimizationRuleSchema = z.object({
  ruleName: z.string().min(1, 'Rule name is required'),
  ruleType: z.enum(['auto_pause', 'auto_promote', 'auto_adjust', 'alert']),
  conditions: z.record(z.any()),
  triggers: z.record(z.any()),
  actions: z.record(z.any()),
  priority: z.number().min(1).max(10).default(5),
  cooldownPeriod: z.number().min(1).max(168).default(24), // hours
});

/**
 * CARD-029: A/B Testing Framework Routes
 */

// Create A/B test
router.post('/ab-tests', isAuthenticatedLocal, async (req, res) => {
  try {
    const validatedData = createABTestSchema.parse(req.body);
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await messageOptimizationService.createABTest(userId, validatedData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        testId: result.testId,
        test: result.test
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error creating A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data'
    });
  }
});

// Create message variant
router.post('/variants', isAuthenticatedLocal, async (req, res) => {
  try {    
    const validatedData = createVariantSchema.parse(req.body);

    const result = await messageOptimizationService.createMessageVariant(
      validatedData.testId,
      validatedData.messageId,
      {
        variantName: validatedData.variantName,
        variantType: validatedData.variantType,
        changes: validatedData.changes,
        changeSummary: validatedData.changeSummary,
      }
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        variantId: result.variantId,
        variant: result.variant
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error creating message variant:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data'
    });
  }
});

// Start A/B test
router.post('/ab-tests/:testId/start', isAuthenticatedLocal, async (req, res) => {
  try {
    const { testId } = req.params;

    const result = await messageOptimizationService.startABTest(testId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        test: result.test
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error starting A/B test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start A/B test'
    });
  }
});

/**
 * Message Performance Tracking Routes
 */

// Track message performance
router.post('/performance/track', isAuthenticatedLocal, async (req, res) => {
  try {
    const validatedData = trackPerformanceSchema.parse(req.body);
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await messageOptimizationService.trackMessagePerformance(
      validatedData.messageId,
      userId,
      validatedData.eventType,
      validatedData.eventData
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error tracking message performance:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data'
    });
  }
});

/**
 * Automated Optimization Routes
 */

// Create optimization rule
router.post('/optimization-rules', isAuthenticatedLocal, async (req, res) => {
  try {
    const validatedData = createOptimizationRuleSchema.parse(req.body);
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await messageOptimizationService.createOptimizationRule(userId, validatedData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        ruleId: result.ruleId,
        rule: result.rule
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error creating optimization rule:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data'
    });
  }
});

// Apply optimization rules
router.post('/optimization-rules/apply', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await messageOptimizationService.applyOptimizationRules(userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        appliedRules: result.appliedRules
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error applying optimization rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply optimization rules'
    });
  }
});

/**
 * Message Effectiveness Scoring Routes
 */

// Calculate effectiveness score
router.post('/effectiveness/:messageId', isAuthenticatedLocal, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const scoring = await messageOptimizationService.calculateEffectivenessScore(messageId, userId);

    res.json({
      success: true,
      messageId,
      scoring
    });
  } catch (error: any) {
    console.error('Error calculating effectiveness score:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate effectiveness score'
    });
  }
});

/**
 * Dashboard and Analytics Routes
 */

// Get optimization dashboard
router.get('/dashboard', isAuthenticatedLocal, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await messageOptimizationService.getOptimizationDashboard(userId);

    if (result.success) {
      res.json({
        success: true,
        dashboard: result.dashboard
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error getting optimization dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

export { router as messageOptimizationRoutes };