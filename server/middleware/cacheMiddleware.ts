import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';
import * as crypto from 'crypto';

/**
 * Cache Middleware
 * Provides HTTP response caching and cache-related middleware functions
 */

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  invalidatePattern?: string;
}

/**
 * Response caching middleware
 * Caches GET responses based on URL and query parameters
 */
export function cacheResponse(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check cache condition if provided
    if (options.condition && !options.condition(req, res)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(req)
        : generateCacheKey(req);

      // Try to get cached response
      const cachedResponse = await cacheService.get('http', cacheKey);
      
      if (cachedResponse) {
        console.log(`💰 Cache HIT: ${req.originalUrl}`);
        
        // Set cache headers
        res.set('X-Cache-Status', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        // Send cached response
        return res
          .status(cachedResponse.statusCode)
          .set(cachedResponse.headers)
          .json(cachedResponse.body);
      }

      console.log(`💸 Cache MISS: ${req.originalUrl}`);
      res.set('X-Cache-Status', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original res.json method
      const originalJson = res.json.bind(res);
      
      // Override res.json to cache the response
      res.json = function(body: any) {
        // Cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseToCache = {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: body,
            timestamp: new Date().toISOString()
          };

          // Cache asynchronously to avoid blocking response
          cacheService.set('http', cacheKey, responseToCache, options.ttl)
            .catch(error => console.error('Cache set error:', error));
        }

        // Call original json method
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware  
 * Invalidates cache based on patterns after write operations
 */
export function invalidateCache(patterns: string[] | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
    
    // Store original res.json method
    const originalJson = res.json.bind(res);
    
    // Override res.json to invalidate cache after successful response
    res.json = function(body: any) {
      // Invalidate cache after successful write operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate asynchronously
        Promise.all(
          patternsArray.map(pattern => cacheService.invalidatePattern(pattern))
        ).then(results => {
          const totalInvalidated = results.reduce((sum, count) => sum + count, 0);
          if (totalInvalidated > 0) {
            console.log(`🗑️ Invalidated ${totalInvalidated} cache entries`);
          }
        }).catch(error => console.error('Cache invalidation error:', error));
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * User-specific cache invalidation middleware
 */
export function invalidateUserCache() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    
    if (!userId) {
      return next();
    }

    // Store original res.json method
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      // Invalidate user cache after successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.invalidateUserCache(userId)
          .then(count => {
            if (count > 0) {
              console.log(`🗑️ Invalidated ${count} cache entries for user ${userId}`);
            }
          })
          .catch(error => console.error('User cache invalidation error:', error));
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request): string {
  const url = req.originalUrl || req.url;
  const method = req.method;
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub || 'anonymous';
  
  // Include relevant headers for cache key
  const relevantHeaders = {
    'accept': req.headers.accept,
    'accept-language': req.headers['accept-language']
  };

  const keyData = {
    method,
    url,
    userId,
    headers: relevantHeaders,
    query: req.query
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Cache statistics middleware
 * Adds cache statistics to response headers
 */
export function cacheStats() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await cacheService.getStatistics();
      res.set('X-Cache-Hit-Rate', `${stats.service.hitRate}%`);
      res.set('X-Cache-Total-Keys', stats.redis.keys.toString());
    } catch (error) {
      // Silently fail to avoid breaking requests
    }
    next();
  };
}

/**
 * Prospect data caching middleware
 */
export function cacheProspectData() {
  return cacheResponse({
    ttl: 3600, // 1 hour
    keyGenerator: (req) => `prospect:${req.params.id}`,
    condition: (req, res) => req.method === 'GET' && !!req.params.id
  });
}

/**
 * Search results caching middleware  
 */
export function cacheSearchResults() {
  return cacheResponse({
    ttl: 1800, // 30 minutes
    keyGenerator: (req) => {
      const searchParams = JSON.stringify(req.body || req.query);
      const hash = crypto.createHash('sha256').update(searchParams).digest('hex');
      return `search:${hash}`;
    },
    condition: (req, res) => req.method === 'POST' && (req.url.includes('/search') || req.url.includes('/prospects'))
  });
}

/**
 * API response caching middleware
 */
export function cacheApiResponse(ttl: number = 600) {
  return cacheResponse({
    ttl,
    keyGenerator: (req) => {
      const paramsStr = JSON.stringify({ 
        query: req.query, 
        body: req.body,
        params: req.params 
      });
      const hash = crypto.createHash('sha256').update(paramsStr).digest('hex');
      return `api:${req.route?.path || req.path}:${hash}`;
    }
  });
}

/**
 * Cache warming middleware
 * Pre-loads cache with common data after user authentication
 */
export function warmCache() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    
    if (userId) {
      // Warm cache asynchronously to avoid blocking request
      cacheService.warmupCache(userId)
        .catch(error => console.error('Cache warmup error:', error));
    }
    
    next();
  };
}