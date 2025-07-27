import { Express, Request, Response } from 'express';
import { apiGateway } from '../middleware/apiGateway';
import { apiMonitoring } from '../middleware/apiMonitoring';

/**
 * API Gateway specific routes
 * Provides management endpoints for the API Gateway system
 */
export function setupApiGatewayRoutes(app: Express): void {
  console.log('🔧 Setting up API Gateway management routes...');

  /**
   * @swagger
   * /api/gateway/status:
   *   get:
   *     summary: Get API Gateway status
   *     tags: [API Gateway]
   *     responses:
   *       200:
   *         description: Gateway status information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: operational
   *                 components:
   *                   type: object
   *                   properties:
   *                     rateLimiting:
   *                       type: boolean
   *                     authentication:
   *                       type: boolean
   *                     monitoring:
   *                       type: boolean
   *                     documentation:
   *                       type: boolean
   */
  app.get('/api/gateway/status', (req: Request, res: Response) => {
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      components: {
        rateLimiting: true,
        authentication: true,
        monitoring: true,
        documentation: true,
        cors: true,
        compression: true,
        security: true
      },
      features: {
        requestTracking: true,
        responseTime: true,
        errorHandling: true,
        metricsCollection: true,
        healthChecks: true,
        apiDocumentation: true
      }
    });
  });

  /**
   * @swagger
   * /api/gateway/metrics:
   *   get:
   *     summary: Get comprehensive API Gateway metrics
   *     tags: [API Gateway]
   *     responses:
   *       200:
   *         description: Detailed metrics and analytics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                 system:
   *                   type: object
   *                 api:
   *                   type: object
   */
  app.get('/api/gateway/metrics', (req: Request, res: Response) => {
    const metrics = apiMonitoring.getMetrics();
    res.json(metrics);
  });

  /**
   * @swagger
   * /api/gateway/health:
   *   get:
   *     summary: Get detailed health check results
   *     tags: [API Gateway]
   *     responses:
   *       200:
   *         description: Health check results for all components
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 overall:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy]
   *                 checks:
   *                   type: object
   */
  app.get('/api/gateway/health', async (req: Request, res: Response) => {
    try {
      const healthChecks = await apiMonitoring.getMetrics();
      const allHealthy = Object.values(healthChecks.api.healthChecks).every(
        (check: any) => check.status === 'healthy'
      );

      res.json({
        overall: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: healthChecks.api.healthChecks,
        uptime: process.uptime(),
        version: process.version
      });
    } catch (error) {
      res.status(500).json({
        overall: 'unhealthy',
        error: 'Failed to perform health checks',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /api/gateway/rate-limits/{identifier}:
   *   get:
   *     summary: Get rate limit status for specific user/IP
   *     tags: [API Gateway]
   *     parameters:
   *       - in: path
   *         name: identifier
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID or IP address
   *     responses:
   *       200:
   *         description: Current rate limit status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RateLimitStatus'
   */
  app.get('/api/gateway/rate-limits/:identifier', (req: Request, res: Response) => {
    const { identifier } = req.params;
    const rateLimitStatus = apiGateway.getRateLimitStatus(identifier);
    res.json(rateLimitStatus);
  });

  /**
   * @swagger
   * /api/gateway/alerts/config:
   *   get:
   *     summary: Get alert configuration thresholds
   *     tags: [API Gateway]
   *     responses:
   *       200:
   *         description: Current alert thresholds
   *   put:
   *     summary: Update alert configuration thresholds
   *     tags: [API Gateway]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               responseTime:
   *                 type: number
   *               errorRate:
   *                 type: number
   *               memoryUsage:
   *                 type: number
   *               cpuUsage:
   *                 type: number
   *     responses:
   *       200:
   *         description: Alert configuration updated
   */
  app.get('/api/gateway/alerts/config', (req: Request, res: Response) => {
    const thresholds = apiMonitoring.getAlertThresholds();
    res.json(thresholds);
  });

  app.put('/api/gateway/alerts/config', (req: Request, res: Response) => {
    try {
      apiMonitoring.updateAlertThresholds(req.body);
      res.json({
        message: 'Alert thresholds updated successfully',
        thresholds: apiMonitoring.getAlertThresholds(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to update alert thresholds',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/gateway/endpoints:
   *   get:
   *     summary: Get list of all available API endpoints
   *     tags: [API Gateway]
   *     responses:
   *       200:
   *         description: List of API endpoints with metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *                 endpoints:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       path:
   *                         type: string
   *                       method:
   *                         type: string
   *                       summary:
   *                         type: string
   *                       tags:
   *                         type: array
   *                         items:
   *                           type: string
   */
  app.get('/api/gateway/endpoints', (req: Request, res: Response) => {
    // This would typically be generated from the OpenAPI spec
    // For now, we'll return a static list of core endpoints
    const endpoints = [
      {
        path: '/api/auth/user',
        method: 'GET',
        summary: 'Get current user information',
        tags: ['Authentication'],
        authenticated: true
      },
      {
        path: '/api/prospects/search',
        method: 'POST',
        summary: 'Search for prospects',
        tags: ['Prospects'],
        authenticated: true
      },
      {
        path: '/api/messages/generate',
        method: 'POST',
        summary: 'Generate AI-powered messages',
        tags: ['Messages'],
        authenticated: true
      },
      {
        path: '/api/campaigns',
        method: 'GET',
        summary: 'Get user campaigns',
        tags: ['Campaigns'],
        authenticated: true
      },
      {
        path: '/api/analytics/dashboard',
        method: 'GET',
        summary: 'Get dashboard analytics',
        tags: ['Analytics'],
        authenticated: true
      }
    ];

    res.json({
      total: endpoints.length,
      endpoints,
      timestamp: new Date().toISOString()
    });
  });

  console.log('✅ API Gateway management routes configured');
}