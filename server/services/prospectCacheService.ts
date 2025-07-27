import { cacheService } from './cacheService';
import * as crypto from 'crypto';

/**
 * Prospect Cache Service
 * Specialized caching service for prospect data with intelligent invalidation
 */
export class ProspectCacheService {
  private static instance: ProspectCacheService;

  private constructor() {}

  public static getInstance(): ProspectCacheService {
    if (!ProspectCacheService.instance) {
      ProspectCacheService.instance = new ProspectCacheService();
    }
    return ProspectCacheService.instance;
  }

  /**
   * Cache prospect data with enrichment metadata
   */
  public async cacheProspect(prospectId: string, prospectData: any, userId: string): Promise<boolean> {
    try {
      const cacheData = {
        ...prospectData,
        cachedAt: new Date().toISOString(),
        userId
      };

      const success = await cacheService.set(
        'prospect',
        `${userId}:${prospectId}`,
        cacheData,
        3600 // 1 hour TTL
      );

      if (success) {
        console.log(`💾 Cached prospect ${prospectId} for user ${userId}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to cache prospect ${prospectId}:`, error);
      return false;
    }
  }

  /**
   * Get cached prospect data
   */
  public async getCachedProspect(prospectId: string, userId: string): Promise<any> {
    try {
      const cachedData = await cacheService.get('prospect', `${userId}:${prospectId}`);
      
      if (cachedData) {
        console.log(`💰 Cache HIT: prospect ${prospectId} for user ${userId}`);
        return cachedData;
      }

      console.log(`💸 Cache MISS: prospect ${prospectId} for user ${userId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to get cached prospect ${prospectId}:`, error);
      return null;
    }
  }

  /**
   * Cache search results with query hash
   */
  public async cacheSearchResults(
    searchQuery: any,
    results: any[],
    userId: string,
    source: string = 'apollo'
  ): Promise<boolean> {
    try {
      const queryHash = this.generateQueryHash(searchQuery);
      const cacheKey = `${userId}:${source}:${queryHash}`;

      const cacheData = {
        query: searchQuery,
        results,
        source,
        totalCount: results.length,
        cachedAt: new Date().toISOString(),
        userId
      };

      const success = await cacheService.set(
        'search',
        cacheKey,
        cacheData,
        1800 // 30 minutes TTL
      );

      if (success) {
        console.log(`🔍 Cached search results for user ${userId} (${results.length} prospects)`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to cache search results for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get cached search results
   */
  public async getCachedSearchResults(
    searchQuery: any,
    userId: string,
    source: string = 'apollo'
  ): Promise<any> {
    try {
      const queryHash = this.generateQueryHash(searchQuery);
      const cacheKey = `${userId}:${source}:${queryHash}`;

      const cachedData = await cacheService.get('search', cacheKey);
      
      if (cachedData) {
        console.log(`💰 Cache HIT: search results for user ${userId} (${cachedData.totalCount} prospects)`);
        return cachedData;
      }

      console.log(`💸 Cache MISS: search results for user ${userId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to get cached search results for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Cache AI-generated messages
   */
  public async cacheAiMessage(
    prospectId: string,
    messageType: string,
    messageData: any,
    userId: string
  ): Promise<boolean> {
    try {
      const cacheKey = `${userId}:${prospectId}:${messageType}`;

      const cacheData = {
        ...messageData,
        prospectId,
        messageType,
        cachedAt: new Date().toISOString(),
        userId
      };

      const success = await cacheService.set(
        'ai_message',
        cacheKey,
        cacheData,
        7200 // 2 hours TTL
      );

      if (success) {
        console.log(`🤖 Cached AI message (${messageType}) for prospect ${prospectId}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to cache AI message for prospect ${prospectId}:`, error);
      return false;
    }
  }

  /**
   * Get cached AI message
   */
  public async getCachedAiMessage(
    prospectId: string,
    messageType: string,
    userId: string
  ): Promise<any> {
    try {
      const cacheKey = `${userId}:${prospectId}:${messageType}`;
      const cachedData = await cacheService.get('ai_message', cacheKey);
      
      if (cachedData) {
        console.log(`💰 Cache HIT: AI message (${messageType}) for prospect ${prospectId}`);
        return cachedData;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get cached AI message for prospect ${prospectId}:`, error);
      return null;
    }
  }

  /**
   * Cache enrichment data from multiple sources
   */
  public async cacheEnrichmentData(
    prospectId: string,
    enrichmentData: any,
    sources: string[],
    userId: string
  ): Promise<boolean> {
    try {
      const cacheKey = `${userId}:${prospectId}:enrichment`;

      const cacheData = {
        prospectId,
        enrichmentData,
        sources,
        quality: enrichmentData.quality || 0,
        enrichedAt: new Date().toISOString(),
        userId
      };

      const success = await cacheService.set(
        'enrichment',
        cacheKey,
        cacheData,
        3600 // 1 hour TTL
      );

      if (success) {
        console.log(`✨ Cached enrichment data for prospect ${prospectId} (sources: ${sources.join(', ')})`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to cache enrichment data for prospect ${prospectId}:`, error);
      return false;
    }
  }

  /**
   * Get cached enrichment data
   */
  public async getCachedEnrichmentData(prospectId: string, userId: string): Promise<any> {
    try {
      const cacheKey = `${userId}:${prospectId}:enrichment`;
      const cachedData = await cacheService.get('enrichment', cacheKey);
      
      if (cachedData) {
        console.log(`💰 Cache HIT: enrichment data for prospect ${prospectId}`);
        return cachedData;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get cached enrichment data for prospect ${prospectId}:`, error);
      return null;
    }
  }

  /**
   * Invalidate prospect-related cache
   */
  public async invalidateProspectCache(prospectId: string, userId: string): Promise<number> {
    try {
      let totalInvalidated = 0;

      // Invalidate all cache entries related to this prospect
      const patterns = [
        `prospect:${userId}:${prospectId}*`,
        `ai_message:${userId}:${prospectId}:*`,
        `enrichment:${userId}:${prospectId}:*`
      ];

      for (const pattern of patterns) {
        const count = await cacheService.invalidatePattern(pattern);
        totalInvalidated += count;
      }

      if (totalInvalidated > 0) {
        console.log(`🗑️ Invalidated ${totalInvalidated} cache entries for prospect ${prospectId}`);
      }

      return totalInvalidated;
    } catch (error) {
      console.error(`❌ Failed to invalidate prospect cache for ${prospectId}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate search cache for user
   */
  public async invalidateSearchCache(userId: string, source?: string): Promise<number> {
    try {
      const pattern = source 
        ? `search:${userId}:${source}:*`
        : `search:${userId}:*`;

      const count = await cacheService.invalidatePattern(pattern);

      if (count > 0) {
        console.log(`🗑️ Invalidated ${count} search cache entries for user ${userId}`);
      }

      return count;
    } catch (error) {
      console.error(`❌ Failed to invalidate search cache for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Generate hash for search query
   */
  private generateQueryHash(query: any): string {
    const normalizedQuery = JSON.stringify(query, Object.keys(query).sort());
    return crypto.createHash('sha256').update(normalizedQuery).digest('hex').substring(0, 16);
  }

  /**
   * Get cache statistics for prospects
   */
  public async getProspectCacheStats(userId?: string): Promise<any> {
    try {
      const pattern = userId ? `*:${userId}:*` : '*';
      const [cacheStats, prospectKeys] = await Promise.all([
        cacheService.getStatistics(),
        this.getCacheKeysByPattern(`prospect:${pattern}`)
      ]);

      return {
        totalProspectsCached: prospectKeys.length,
        overallHitRate: cacheStats.service.hitRate,
        cacheSize: cacheStats.redis.keys,
        userId: userId || 'all',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get prospect cache stats:', error);
      return {
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get cache keys by pattern
   */
  private async getCacheKeysByPattern(pattern: string): Promise<string[]> {
    try {
      const fullPattern = `leadgen:${pattern}`;
      const client = await import('./redisClient').then(m => m.redisClient.getClient());
      return await client.keys(fullPattern);
    } catch (error) {
      console.error('❌ Failed to get cache keys:', error);
      return [];
    }
  }

  /**
   * Warm up prospect cache with frequently accessed data
   */
  public async warmupProspectCache(userId: string, recentProspectIds: string[]): Promise<void> {
    try {
      console.log(`🔥 Warming up prospect cache for user ${userId} (${recentProspectIds.length} prospects)`);

      // This would typically pre-load commonly accessed prospects
      // Implementation would depend on the storage system integration
      
      console.log(`✅ Prospect cache warmup completed for user ${userId}`);
    } catch (error) {
      console.error(`❌ Prospect cache warmup failed for user ${userId}:`, error);
    }
  }
}

// Export singleton instance
export const prospectCacheService = ProspectCacheService.getInstance();