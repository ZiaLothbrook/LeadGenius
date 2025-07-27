import { redisClient } from './redisClient';
import Redis from 'ioredis';

/**
 * Cache Service
 * Provides high-level caching operations with performance monitoring
 */
export class CacheService {
  private static instance: CacheService;
  private client: Redis;
  private metrics: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
  } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  // Cache TTL configurations (in seconds)
  private readonly TTL_CONFIG = {
    PROSPECT_DATA: 3600,        // 1 hour
    SEARCH_RESULTS: 1800,       // 30 minutes
    USER_SESSION: 86400,        // 24 hours
    API_RESPONSES: 600,         // 10 minutes
    ANALYTICS_DATA: 1800,       // 30 minutes
    AI_RESPONSES: 7200,         // 2 hours
    SHORT_TERM: 300,            // 5 minutes
    LONG_TERM: 86400,          // 24 hours
    VERY_LONG_TERM: 604800     // 7 days
  };

  private constructor() {
    this.client = redisClient.getClient();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(namespace: string, key: string): string {
    return `leadgen:${namespace}:${key}`;
  }

  /**
   * Set cache value with TTL
   */
  public async set(
    namespace: string, 
    key: string, 
    value: any, 
    ttl?: number
  ): Promise<boolean> {
    try {
      if (!redisClient.isRedisConnected()) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      const cacheKey = this.generateKey(namespace, key);
      const serializedValue = JSON.stringify(value);
      const cacheTTL = ttl || this.TTL_CONFIG.SHORT_TERM;

      await this.client.setex(cacheKey, cacheTTL, serializedValue);
      
      this.metrics.sets++;
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for ${namespace}:${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get cache value
   */
  public async get<T = any>(namespace: string, key: string): Promise<T | null> {
    try {
      if (!redisClient.isRedisConnected()) {
        console.warn('⚠️ Redis not connected, cache miss');
        this.metrics.misses++;
        return null;
      }

      const cacheKey = this.generateKey(namespace, key);
      const cachedValue = await this.client.get(cacheKey);

      if (cachedValue === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return JSON.parse(cachedValue) as T;
    } catch (error) {
      console.error(`❌ Cache get error for ${namespace}:${key}:`, error);
      this.metrics.errors++;
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Delete cache value
   */
  public async delete(namespace: string, key: string): Promise<boolean> {
    try {
      if (!redisClient.isRedisConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(namespace, key);
      const result = await this.client.del(cacheKey);
      
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      console.error(`❌ Cache delete error for ${namespace}:${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(namespace: string, key: string): Promise<boolean> {
    try {
      if (!redisClient.isRedisConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(namespace, key);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error(`❌ Cache exists error for ${namespace}:${key}:`, error);
      return false;
    }
  }

  /**
   * Set cache with expiration time
   */
  public async setWithExpiry(
    namespace: string, 
    key: string, 
    value: any, 
    expiryDate: Date
  ): Promise<boolean> {
    try {
      if (!redisClient.isRedisConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(namespace, key);
      const serializedValue = JSON.stringify(value);
      
      await this.client.set(cacheKey, serializedValue);
      await this.client.expireat(cacheKey, Math.floor(expiryDate.getTime() / 1000));
      
      this.metrics.sets++;
      return true;
    } catch (error) {
      console.error(`❌ Cache setWithExpiry error for ${namespace}:${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  public async getOrSet<T = any>(
    namespace: string,
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cachedValue = await this.get<T>(namespace, key);
      if (cachedValue !== null) {
        return cachedValue;
      }

      // Cache miss - fetch data
      const freshData = await fetchFunction();
      
      // Store in cache for next time
      await this.set(namespace, key, freshData, ttl);
      
      return freshData;
    } catch (error) {
      console.error(`❌ Cache getOrSet error for ${namespace}:${key}:`, error);
      this.metrics.errors++;
      
      // Fallback to direct fetch on cache error
      return await fetchFunction();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  public async invalidatePattern(pattern: string): Promise<number> {
    try {
      if (!redisClient.isRedisConnected()) {
        return 0;
      }

      const fullPattern = `leadgen:${pattern}`;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deletedCount = await this.client.del(...keys);
      this.metrics.deletes += deletedCount;
      
      console.log(`🗑️ Invalidated ${deletedCount} keys matching pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      console.error(`❌ Cache invalidatePattern error for ${pattern}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Invalidate all cache for a user
   */
  public async invalidateUserCache(userId: string): Promise<number> {
    return await this.invalidatePattern(`*:user:${userId}:*`);
  }

  /**
   * Cache prospect data
   */
  public async cacheProspectData(prospectId: string, data: any): Promise<boolean> {
    return await this.set('prospects', prospectId, data, this.TTL_CONFIG.PROSPECT_DATA);
  }

  /**
   * Get cached prospect data
   */
  public async getCachedProspectData(prospectId: string): Promise<any> {
    return await this.get('prospects', prospectId);
  }

  /**
   * Cache search results
   */
  public async cacheSearchResults(
    searchHash: string, 
    results: any, 
    userId: string
  ): Promise<boolean> {
    const key = `user:${userId}:search:${searchHash}`;
    return await this.set('search', key, results, this.TTL_CONFIG.SEARCH_RESULTS);
  }

  /**
   * Get cached search results
   */
  public async getCachedSearchResults(searchHash: string, userId: string): Promise<any> {
    const key = `user:${userId}:search:${searchHash}`;
    return await this.get('search', key);
  }

  /**
   * Cache API response
   */
  public async cacheApiResponse(
    endpoint: string, 
    params: string, 
    response: any
  ): Promise<boolean> {
    const key = `${endpoint}:${params}`;
    return await this.set('api', key, response, this.TTL_CONFIG.API_RESPONSES);
  }

  /**
   * Get cached API response
   */
  public async getCachedApiResponse(endpoint: string, params: string): Promise<any> {
    const key = `${endpoint}:${params}`;
    return await this.get('api', key);
  }

  /**
   * Cache user session data
   */
  public async cacheUserSession(userId: string, sessionData: any): Promise<boolean> {
    return await this.set('session', userId, sessionData, this.TTL_CONFIG.USER_SESSION);
  }

  /**
   * Get cached user session
   */
  public async getCachedUserSession(userId: string): Promise<any> {
    return await this.get('session', userId);
  }

  /**
   * Cache AI response
   */
  public async cacheAiResponse(
    inputHash: string, 
    response: any, 
    model: string
  ): Promise<boolean> {
    const key = `${model}:${inputHash}`;
    return await this.set('ai', key, response, this.TTL_CONFIG.AI_RESPONSES);
  }

  /**
   * Get cached AI response
   */
  public async getCachedAiResponse(inputHash: string, model: string): Promise<any> {
    const key = `${model}:${inputHash}`;
    return await this.get('ai', key);
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): any {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? Math.round((this.metrics.hits / total) * 100) : 0;

    return {
      ...this.metrics,
      hitRate,
      totalRequests: total
    };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Get cache statistics
   */
  public async getStatistics(): Promise<any> {
    const redisStats = await redisClient.getCacheStats();
    const serviceMetrics = this.getMetrics();

    return {
      redis: redisStats,
      service: serviceMetrics,
      connected: redisClient.isRedisConnected(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmupCache(userId: string): Promise<void> {
    try {
      console.log(`🔥 Warming up cache for user ${userId}`);
      
      // This would typically pre-load commonly accessed data
      // Implementation depends on specific use case
      
      console.log(`✅ Cache warmup completed for user ${userId}`);
    } catch (error) {
      console.error(`❌ Cache warmup failed for user ${userId}:`, error);
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();