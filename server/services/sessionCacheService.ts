import { cacheService } from './cacheService';
import session from 'express-session';
import { redisClient } from './redisClient';
import * as ConnectRedis from 'connect-redis';

/**
 * Session Cache Service
 * Manages user sessions with Redis backing store
 */
export class SessionCacheService {
  private static instance: SessionCacheService;
  private redisStore: any;

  private constructor() {
    this.initializeRedisStore();
  }

  public static getInstance(): SessionCacheService {
    if (!SessionCacheService.instance) {
      SessionCacheService.instance = new SessionCacheService();
    }
    return SessionCacheService.instance;
  }

  /**
   * Initialize Redis store for sessions
   */
  private initializeRedisStore(): void {
    try {
      const RedisStore = (ConnectRedis as any).default(session);
      
      this.redisStore = new RedisStore({
        client: redisClient.getClient(),
        prefix: 'leadgen:session:',
        ttl: 86400, // 24 hours
        disableTouch: false,
        disableTTL: false
      });

      console.log('✅ Redis session store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Redis session store:', error);
      this.redisStore = null;
    }
  }

  /**
   * Get Redis session store
   */
  public getSessionStore(): any {
    return this.redisStore;
  }

  /**
   * Store user session data
   */
  public async storeUserSession(
    userId: string, 
    sessionData: any, 
    expiryHours: number = 24
  ): Promise<boolean> {
    try {
      const ttl = expiryHours * 3600; // Convert to seconds
      const success = await cacheService.set(
        'user_session', 
        userId, 
        sessionData, 
        ttl
      );

      if (success) {
        console.log(`💾 Stored session for user ${userId} (expires in ${expiryHours}h)`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to store session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Retrieve user session data
   */
  public async getUserSession(userId: string): Promise<any> {
    try {
      const sessionData = await cacheService.get('user_session', userId);
      
      if (sessionData) {
        console.log(`📖 Retrieved session for user ${userId}`);
        return sessionData;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to retrieve session for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update user session data
   */
  public async updateUserSession(
    userId: string, 
    updates: any, 
    expiryHours: number = 24
  ): Promise<boolean> {
    try {
      // Get existing session data
      const existingSession = await this.getUserSession(userId) || {};
      
      // Merge with updates
      const updatedSession = {
        ...existingSession,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      // Store updated session
      return await this.storeUserSession(userId, updatedSession, expiryHours);
    } catch (error) {
      console.error(`❌ Failed to update session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Delete user session
   */
  public async deleteUserSession(userId: string): Promise<boolean> {
    try {
      const success = await cacheService.delete('user_session', userId);
      
      if (success) {
        console.log(`🗑️ Deleted session for user ${userId}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to delete session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user session exists and is valid
   */
  public async isSessionValid(userId: string): Promise<boolean> {
    try {
      const sessionData = await this.getUserSession(userId);
      
      if (!sessionData) {
        return false;
      }

      // Check if session has required fields
      if (!sessionData.createdAt && !sessionData.lastUpdated) {
        return false;
      }

      // Additional validation logic can be added here
      return true;
    } catch (error) {
      console.error(`❌ Session validation failed for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Store temporary user data (short-term cache)
   */
  public async storeTempUserData(
    userId: string, 
    dataType: string, 
    data: any, 
    ttlMinutes: number = 30
  ): Promise<boolean> {
    try {
      const key = `${userId}:${dataType}`;
      const ttl = ttlMinutes * 60; // Convert to seconds
      
      const success = await cacheService.set('temp_user_data', key, data, ttl);
      
      if (success) {
        console.log(`💾 Stored temp data ${dataType} for user ${userId} (${ttlMinutes}m TTL)`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to store temp data for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Retrieve temporary user data
   */
  public async getTempUserData(userId: string, dataType: string): Promise<any> {
    try {
      const key = `${userId}:${dataType}`;
      return await cacheService.get('temp_user_data', key);
    } catch (error) {
      console.error(`❌ Failed to retrieve temp data for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Clear all temporary data for user
   */
  public async clearTempUserData(userId: string): Promise<number> {
    try {
      const pattern = `temp_user_data:${userId}:*`;
      return await cacheService.invalidatePattern(pattern);
    } catch (error) {
      console.error(`❌ Failed to clear temp data for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Store user preferences in cache
   */
  public async storeUserPreferences(userId: string, preferences: any): Promise<boolean> {
    try {
      const success = await cacheService.set(
        'user_preferences', 
        userId, 
        preferences, 
        86400 // 24 hours
      );

      if (success) {
        console.log(`⚙️ Stored preferences for user ${userId}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Failed to store preferences for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Retrieve user preferences from cache
   */
  public async getUserPreferences(userId: string): Promise<any> {
    try {
      return await cacheService.get('user_preferences', userId);
    } catch (error) {
      console.error(`❌ Failed to retrieve preferences for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStatistics(): Promise<any> {
    try {
      const cacheStats = await cacheService.getStatistics();
      
      return {
        redisConnected: redisClient.isRedisConnected(),
        sessionStoreAvailable: !!this.redisStore,
        cacheHitRate: cacheStats.service.hitRate,
        totalSessions: cacheStats.redis.keys || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get session statistics:', error);
      return {
        redisConnected: false,
        sessionStoreAvailable: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Cleanup expired sessions (maintenance function)
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      // Redis automatically handles TTL expiration, but we can implement
      // additional cleanup logic here if needed
      console.log('🧹 Running session cleanup...');
      
      // For now, just return 0 as Redis handles expiration automatically
      return 0;
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const sessionCacheService = SessionCacheService.getInstance();