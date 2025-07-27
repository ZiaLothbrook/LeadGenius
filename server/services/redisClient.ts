import Redis from 'ioredis';

/**
 * Redis Client Service
 * Provides centralized Redis connection and configuration management
 */
export class RedisClient {
  private static instance: RedisClient;
  private client!: Redis; // Use definite assignment assertion
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 2000; // 2 seconds

  private constructor() {
    this.initializeClient();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initialize Redis client with connection handling
   */
  private initializeClient(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    console.log('🔴 Initializing Redis client...');

    this.client = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableOfflineQueue: false,
    });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔴 Redis client connected');
      this.isConnected = true;
      this.connectionRetries = 0;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis client error:', error.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('🔴 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (ms: number) => {
      console.log(`🔄 Redis reconnecting in ${ms}ms...`);
    });

    this.client.on('end', () => {
      console.log('🔴 Redis connection ended');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis with retry logic
   */
  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.error(`❌ Redis connection failed (attempt ${this.connectionRetries + 1}):`, error);
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Retrying Redis connection in ${this.retryDelay}ms...`);
        setTimeout(() => this.connect(), this.retryDelay);
      } else {
        console.error('💥 Redis connection failed after maximum retries. Running without cache.');
      }
    }
  }

  /**
   * Get Redis client instance
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isRedisConnected(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Health check for Redis connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get Redis connection info
   */
  public async getInfo(): Promise<any> {
    try {
      if (!this.isRedisConnected()) {
        return {
          status: 'disconnected',
          connected: false,
          error: 'Redis not connected'
        };
      }

      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');

      return {
        status: 'connected',
        connected: true,
        server: this.parseRedisInfo(info),
        memory: this.parseRedisInfo(memory),
        stats: this.parseRedisInfo(stats),
        keyspace: await this.getKeyspaceInfo()
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Get keyspace information
   */
  private async getKeyspaceInfo(): Promise<any> {
    try {
      const keyspace = await this.client.info('keyspace');
      return this.parseRedisInfo(keyspace);
    } catch (error) {
      return {};
    }
  }

  /**
   * Flush all Redis data (use with caution)
   */
  public async flushAll(): Promise<boolean> {
    try {
      await this.client.flushall();
      console.log('🗑️ Redis cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to flush Redis cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<any> {
    try {
      if (!this.isRedisConnected()) {
        return { connected: false, keys: 0, memory: 0 };
      }

      const info = await this.getInfo();
      const keyCount = await this.client.dbsize();
      
      return {
        connected: true,
        keys: keyCount,
        memoryUsed: info.memory?.used_memory || 0,
        memoryPeak: info.memory?.used_memory_peak || 0,
        hitRate: this.calculateHitRate(info.stats),
        uptime: info.server?.uptime_in_seconds || 0,
        version: info.server?.redis_version || 'unknown'
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateHitRate(stats: any): number {
    if (!stats || !stats.keyspace_hits || !stats.keyspace_misses) {
      return 0;
    }
    
    const hits = stats.keyspace_hits;
    const misses = stats.keyspace_misses;
    const total = hits + misses;
    
    return total > 0 ? Math.round((hits / total) * 100) : 0;
  }

  /**
   * Close Redis connection
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      console.log('🔴 Redis client disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error);
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();