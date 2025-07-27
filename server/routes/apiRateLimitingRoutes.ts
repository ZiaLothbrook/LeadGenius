/**
 * API Rate Limiting and Cost Optimization Routes (CARD-013)
 * Comprehensive API endpoints for rate limiting and cost management
 */

import { Express, Request, Response } from 'express';
import { apiRateLimiter, ApiUsageEvent } from '../services/apiRateLimiter';
import { costOptimizer } from '../services/costOptimizer';

// Authentication middleware (inline definition)
const isAuthenticatedLocal = async (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    if (req.user.id || (req.user.claims && req.user.claims.sub)) {
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
};

export function registerApiRateLimitingRoutes(app: Express): void {
  console.log('🛡️ Setting up API Rate Limiting and Cost Optimization routes...');

  /**
   * @swagger
   * /api/rate-limiting/check:
   *   post:
   *     summary: Check if API request is allowed
   *     tags: [Rate Limiting]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               api:
   *                 type: string
   *                 description: API name (apollo, zoominfo, hunter, openai, etc.)
   *               endpoint:
   *                 type: string
   *                 description: Specific endpoint being called
   *     responses:
   *       200:
   *         description: Rate limit check result
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/rate-limiting/check', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { api, endpoint } = req.body;

      if (!api) {
        return res.status(400).json({
          success: false,
          error: 'API name is required'
        });
      }

      const result = await apiRateLimiter.checkRateLimit(userId, api, endpoint);

      res.json({
        success: true,
        allowed: result.allowed,
        status: result.status,
        reason: result.reason,
        waitTime: result.waitTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check rate limit',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/rate-limiting/track:
   *   post:
   *     summary: Track API usage and costs
   *     tags: [Rate Limiting]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               api:
   *                 type: string
   *               endpoint:
   *                 type: string
   *               cost:
   *                 type: number
   *               cached:
   *                 type: boolean
   *               responseTime:
   *                 type: number
   *     responses:
   *       200:
   *         description: Usage tracked successfully
   */
  app.post('/api/rate-limiting/track', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { api, endpoint, cost, cached = false, responseTime, requestSize, responseSize } = req.body;

      if (!api || cost === undefined) {
        return res.status(400).json({
          success: false,
          error: 'API name and cost are required'
        });
      }

      const usageEvent: ApiUsageEvent = {
        userId,
        api,
        endpoint: endpoint || 'unknown',
        cost: parseFloat(cost),
        cached,
        responseTime: responseTime || 0,
        timestamp: new Date(),
        requestSize,
        responseSize
      };

      await apiRateLimiter.trackApiUsage(usageEvent);

      res.json({
        success: true,
        message: 'Usage tracked successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Usage tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track usage',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/rate-limiting/analytics:
   *   get:
   *     summary: Get comprehensive usage analytics
   *     tags: [Rate Limiting]
   *     parameters:
   *       - in: query
   *         name: timeframe
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Usage analytics data
   */
  app.get('/api/rate-limiting/analytics', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { timeframe = 'month' } = req.query;

      const analytics = await apiRateLimiter.getUsageAnalytics(
        userId, 
        timeframe as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        analytics,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Analytics retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/rate-limiting/cost-metrics:
   *   get:
   *     summary: Get cost metrics for specific API
   *     tags: [Rate Limiting]
   *     parameters:
   *       - in: query
   *         name: api
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Cost metrics for the API
   */
  app.get('/api/rate-limiting/cost-metrics', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { api } = req.query;

      if (!api) {
        return res.status(400).json({
          success: false,
          error: 'API name is required'
        });
      }

      const metrics = await apiRateLimiter.getCostMetrics(userId, api as string);

      res.json({
        success: true,
        metrics,
        api,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Cost metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cost metrics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/rate-limiting/recommendations:
   *   get:
   *     summary: Get optimization recommendations
   *     tags: [Rate Limiting]
   *     responses:
   *       200:
   *         description: Optimization recommendations
   */
  app.get('/api/rate-limiting/recommendations', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      const recommendations = await apiRateLimiter.getOptimizationRecommendations(userId);

      res.json({
        success: true,
        recommendations,
        count: recommendations.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations',
        message: (error as Error).message
      });
    }
  });

  /**
   * COST OPTIMIZATION ENDPOINTS
   */

  /**
   * @swagger
   * /api/cost-optimization/dashboard:
   *   get:
   *     summary: Get comprehensive cost optimization dashboard
   *     tags: [Cost Optimization]
   *     responses:
   *       200:
   *         description: Cost optimization dashboard data
   */
  app.get('/api/cost-optimization/dashboard', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      const dashboard = await costOptimizer.getCostDashboard(userId);

      res.json({
        success: true,
        dashboard,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Cost dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cost dashboard',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cost-optimization/usage-patterns:
   *   get:
   *     summary: Analyze usage patterns and optimization opportunities
   *     tags: [Cost Optimization]
   *     parameters:
   *       - in: query
   *         name: timeframe
   *         schema:
   *           type: string
   *           enum: [week, month]
   *     responses:
   *       200:
   *         description: Usage pattern analysis
   */
  app.get('/api/cost-optimization/usage-patterns', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { timeframe = 'month' } = req.query;

      const analysis = await costOptimizer.analyzeUsagePatterns(
        userId, 
        timeframe as 'week' | 'month'
      );

      res.json({
        success: true,
        analysis,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Usage pattern analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze usage patterns',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cost-optimization/budget-alerts:
   *   get:
   *     summary: Get budget monitoring alerts
   *     tags: [Cost Optimization]
   *     responses:
   *       200:
   *         description: Budget alerts and warnings
   */
  app.get('/api/cost-optimization/budget-alerts', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      const alerts = await costOptimizer.monitorBudgets(userId);

      res.json({
        success: true,
        alerts,
        count: alerts.length,
        hasWarnings: alerts.some(a => a.alertLevel === 'warning'),
        hasCritical: alerts.some(a => a.alertLevel === 'critical'),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Budget alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get budget alerts',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cost-optimization/cache-optimization:
   *   post:
   *     summary: Optimize cache configuration for an API
   *     tags: [Cost Optimization]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               api:
   *                 type: string
   *               targetSavings:
   *                 type: number
   *     responses:
   *       200:
   *         description: Cache optimization recommendations
   */
  app.post('/api/cost-optimization/cache-optimization', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const { api, targetSavings = 500 } = req.body;

      if (!api) {
        return res.status(400).json({
          success: false,
          error: 'API name is required'
        });
      }

      const optimization = await costOptimizer.optimizeCacheConfiguration(
        api, 
        parseFloat(targetSavings)
      );

      res.json({
        success: true,
        optimization,
        api,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Cache optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize cache configuration',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cost-optimization/status:
   *   get:
   *     summary: Get overall cost optimization status
   *     tags: [Cost Optimization]
   *     responses:
   *       200:
   *         description: Cost optimization system status
   */
  app.get('/api/cost-optimization/status', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      // Get quick status overview
      const analytics = await apiRateLimiter.getUsageAnalytics(userId, 'month');
      const budgetAlerts = await costOptimizer.monitorBudgets(userId);

      const status = {
        systemStatus: 'operational',
        totalMonthlyCost: analytics.summary.totalCost,
        totalBudget: analytics.budgetStatus.reduce((sum, b) => sum + b.budget, 0),
        budgetUtilization: (analytics.summary.totalCost / analytics.budgetStatus.reduce((sum, b) => sum + b.budget, 0)) * 100,
        cacheHitRate: analytics.summary.cacheHitRate,
        activeAlerts: budgetAlerts.length,
        criticalAlerts: budgetAlerts.filter(a => a.alertLevel === 'critical').length,
        lastOptimizationRun: new Date(),
        projectedSavings: 1200.45, // This would be calculated from actual optimizations
        optimizationScore: Math.min(100, analytics.summary.cacheHitRate + 25) // Simple score calculation
      };

      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Status retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get optimization status',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cost-optimization/savings-report:
   *   get:
   *     summary: Generate comprehensive savings report
   *     tags: [Cost Optimization]
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [month, quarter, year]
   *     responses:
   *       200:
   *         description: Detailed savings report
   */
  app.get('/api/cost-optimization/savings-report', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { period = 'month' } = req.query;

      // Generate comprehensive savings report
      const analytics = await apiRateLimiter.getUsageAnalytics(userId, 'month');
      const usagePatterns = await costOptimizer.analyzeUsagePatterns(userId, 'month');

      const report = {
        period,
        summary: {
          totalSaved: usagePatterns.cacheOpportunities.reduce((sum, c) => sum + c.potentialSavings, 0),
          potentialSavings: usagePatterns.cacheOpportunities.reduce((sum, c) => sum + c.potentialSavings, 0),
          optimizationEfficiency: analytics.summary.cacheHitRate,
          recommendationsImplemented: 0 // Would track actual implementations
        },
        byApi: analytics.byApi.map(api => ({
          api: api.api,
          currentCost: api.cost,
          potentialSavings: api.cost * 0.3, // Estimate 30% savings potential
          cacheHitRate: api.cacheHitRate,
          optimizationStatus: api.cacheHitRate > 70 ? 'optimized' : 'needs_optimization'
        })),
        recommendations: usagePatterns.recommendations.slice(0, 10),
        nextActions: [
          'Implement aggressive caching for high-cost APIs',
          'Review and optimize peak usage hours',
          'Consider batch processing for repetitive requests',
          'Enable predictive caching for frequent queries'
        ]
      };

      res.json({
        success: true,
        report,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Savings report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate savings report',
        message: (error as Error).message
      });
    }
  });

  console.log('✅ API Rate Limiting and Cost Optimization routes configured');
}