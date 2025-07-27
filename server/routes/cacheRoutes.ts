import { Express, Request, Response } from 'express';
import { cacheService } from '../services/cacheService';
import { redisClient } from '../services/redisClient';
import { sessionCacheService } from '../services/sessionCacheService';

/**
 * Cache Management Routes
 * Provides endpoints for cache operations, monitoring, and administration
 */
export function setupCacheRoutes(app: Express): void {
  console.log('🔧 Setting up cache management routes...');

  /**
   * @swagger
   * /api/cache/status:
   *   get:
   *     summary: Get cache system status
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Cache system status and statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 redis:
   *                   type: object
   *                 service:
   *                   type: object
   *                 connected:
   *                   type: boolean
   */
  app.get('/api/cache/status', async (req: Request, res: Response) => {
    try {
      const statistics = await cacheService.getStatistics();
      const healthCheck = await redisClient.healthCheck();
      
      res.json({
        status: healthCheck ? 'operational' : 'degraded',
        connected: redisClient.isRedisConnected(),
        healthCheck,
        statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        connected: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /api/cache/metrics:
   *   get:
   *     summary: Get detailed cache metrics
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Comprehensive cache performance metrics
   */
  app.get('/api/cache/metrics', async (req: Request, res: Response) => {
    try {
      const [cacheStats, redisInfo] = await Promise.all([
        cacheService.getStatistics(),
        redisClient.getInfo()
      ]);

      res.json({
        cache: cacheStats,
        redis: redisInfo,
        performance: {
          hitRate: cacheStats.service.hitRate,
          totalRequests: cacheStats.service.totalRequests,
          errorRate: cacheStats.service.errors > 0 
            ? Math.round((cacheStats.service.errors / cacheStats.service.totalRequests) * 100) 
            : 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve cache metrics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/health:
   *   get:
   *     summary: Comprehensive cache health check
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Health status of all cache components
   */
  app.get('/api/cache/health', async (req: Request, res: Response) => {
    try {
      const [redisHealth, sessionStats] = await Promise.all([
        redisClient.healthCheck(),
        sessionCacheService.getSessionStatistics()
      ]);

      const overall = redisHealth && sessionStats.redisConnected ? 'healthy' : 'degraded';

      res.json({
        overall,
        components: {
          redis: {
            status: redisHealth ? 'healthy' : 'unhealthy',
            connected: redisClient.isRedisConnected()
          },
          sessions: {
            status: sessionStats.sessionStoreAvailable ? 'healthy' : 'unhealthy',
            connected: sessionStats.redisConnected
          },
          cache: {
            status: 'healthy',
            hitRate: sessionStats.cacheHitRate
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        overall: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /api/cache/invalidate:
   *   post:
   *     summary: Invalidate cache by pattern
   *     tags: [Cache]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               pattern:
   *                 type: string
   *                 description: Cache key pattern to invalidate
   *               userId:
   *                 type: string
   *                 description: Optional user ID to invalidate user-specific cache
   *     responses:
   *       200:
   *         description: Cache invalidation result
   */
  app.post('/api/cache/invalidate', async (req: Request, res: Response) => {
    try {
      const { pattern, userId } = req.body;

      if (!pattern && !userId) {
        return res.status(400).json({
          error: 'Pattern or userId is required for cache invalidation'
        });
      }

      let invalidatedCount = 0;

      if (userId) {
        invalidatedCount = await cacheService.invalidateUserCache(userId);
      } else if (pattern) {
        invalidatedCount = await cacheService.invalidatePattern(pattern);
      }

      res.json({
        success: true,
        invalidatedCount,
        pattern: pattern || `user:${userId}:*`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Cache invalidation failed',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/flush:
   *   post:
   *     summary: Flush all cache data (admin only)
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Cache flush result
   */
  app.post('/api/cache/flush', async (req: Request, res: Response) => {
    try {
      // Add admin check here if needed
      const success = await redisClient.flushAll();

      if (success) {
        cacheService.resetMetrics();
        res.json({
          success: true,
          message: 'All cache data flushed successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to flush cache data'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Cache flush failed',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/keys:
   *   get:
   *     summary: List cache keys by pattern
   *     tags: [Cache]
   *     parameters:
   *       - in: query
   *         name: pattern
   *         schema:
   *           type: string
   *         description: Pattern to match cache keys
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *         description: Maximum number of keys to return
   *     responses:
   *       200:
   *         description: List of matching cache keys
   */
  app.get('/api/cache/keys', async (req: Request, res: Response) => {
    try {
      const { pattern = 'leadgen:*', limit = 100 } = req.query;
      
      if (!redisClient.isRedisConnected()) {
        return res.status(503).json({
          error: 'Redis not connected',
          keys: []
        });
      }

      const client = redisClient.getClient();
      const keys = await client.keys(pattern as string);
      const limitedKeys = keys.slice(0, Number(limit));

      res.json({
        keys: limitedKeys,
        total: keys.length,
        pattern,
        limit: Number(limit),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve cache keys',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/key/{key}:
   *   get:
   *     summary: Get cache value by key
   *     tags: [Cache]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *         description: Cache key to retrieve
   *     responses:
   *       200:
   *         description: Cache value and metadata
   *   delete:
   *     summary: Delete cache key
   *     tags: [Cache]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *         description: Cache key to delete
   *     responses:
   *       200:
   *         description: Deletion result
   */
  app.get('/api/cache/key/:key', async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      
      if (!redisClient.isRedisConnected()) {
        return res.status(503).json({
          error: 'Redis not connected'
        });
      }

      const client = redisClient.getClient();
      const [value, ttl] = await Promise.all([
        client.get(key),
        client.ttl(key)
      ]);

      if (value === null) {
        return res.status(404).json({
          error: 'Key not found',
          key
        });
      }

      res.json({
        key,
        value: JSON.parse(value),
        ttl: ttl > 0 ? ttl : null,
        exists: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve cache key',
        message: (error as Error).message
      });
    }
  });

  app.delete('/api/cache/key/:key', async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      
      if (!redisClient.isRedisConnected()) {
        return res.status(503).json({
          error: 'Redis not connected'
        });
      }

      const client = redisClient.getClient();
      const result = await client.del(key);

      res.json({
        success: result > 0,
        key,
        deleted: result > 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete cache key',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/session/stats:
   *   get:
   *     summary: Get session cache statistics
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Session cache statistics
   */
  app.get('/api/cache/session/stats', async (req: Request, res: Response) => {
    try {
      const stats = await sessionCacheService.getSessionStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve session statistics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/cache/warmup:
   *   post:
   *     summary: Warm up cache with common data
   *     tags: [Cache]
   *     responses:
   *       200:
   *         description: Cache warmup initiated
   */
  app.post('/api/cache/warmup', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      
      if (userId) {
        // Initiate cache warmup asynchronously
        cacheService.warmupCache(userId)
          .catch(error => console.error('Cache warmup error:', error));
      }

      res.json({
        success: true,
        message: 'Cache warmup initiated',
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to initiate cache warmup',
        message: (error as Error).message
      });
    }
  });

  console.log('✅ Cache management routes configured');
}