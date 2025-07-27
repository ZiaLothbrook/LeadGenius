/**
 * API Rate Limiting and Cost Optimization Service (CARD-013)
 * Intelligent rate limiting, cost tracking, and optimization for all external APIs
 */

export interface ApiConfig {
  name: string;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  costPerRequest: number; // in USD
  monthlyBudget: number;
  cacheTtl: number; // seconds
  enabled: boolean;
}

export interface RateLimitStatus {
  api: string;
  userId: string;
  minute: { used: number; limit: number; resetAt: Date };
  hour: { used: number; limit: number; resetAt: Date };
  day: { used: number; limit: number; resetAt: Date };
  month: { used: number; limit: number; resetAt: Date };
  isBlocked: boolean;
  blockReason?: string;
}

export interface CostMetrics {
  api: string;
  userId: string;
  daily: { requests: number; cost: number };
  monthly: { requests: number; cost: number; budget: number };
  yearToDate: { requests: number; cost: number };
  estimatedMonthlyCost: number;
  budgetUtilization: number; // percentage
  savingsFromCache: number;
}

export interface ApiUsageEvent {
  userId: string;
  api: string;
  endpoint: string;
  cost: number;
  cached: boolean;
  responseTime: number;
  timestamp: Date;
  requestSize?: number;
  responseSize?: number;
}

export class ApiRateLimiter {
  private apiConfigs: Map<string, ApiConfig> = new Map();
  private userLimits: Map<string, Map<string, any>> = new Map(); // userId -> api -> limits
  private costTracker: Map<string, Map<string, any>> = new Map(); // userId -> api -> costs
  private cacheHits: Map<string, number> = new Map(); // api -> hit count

  constructor() {
    this.initializeApiConfigs();
    this.startCleanupTimer();
    console.log('🛡️ API Rate Limiter and Cost Optimizer initialized');
  }

  /**
   * Initialize API configurations with default limits and costs
   */
  private initializeApiConfigs(): void {
    const configs: ApiConfig[] = [
      {
        name: 'apollo',
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 500,
        maxRequestsPerDay: 5000,
        costPerRequest: 0.02, // $0.02 per request
        monthlyBudget: 500.00,
        cacheTtl: 3600, // 1 hour
        enabled: true
      },
      {
        name: 'zoominfo',
        maxRequestsPerMinute: 5,
        maxRequestsPerHour: 200,
        maxRequestsPerDay: 2000,
        costPerRequest: 0.05, // $0.05 per request
        monthlyBudget: 300.00,
        cacheTtl: 7200, // 2 hours
        enabled: true
      },
      {
        name: 'hunter',
        maxRequestsPerMinute: 15,
        maxRequestsPerHour: 800,
        maxRequestsPerDay: 8000,
        costPerRequest: 0.01, // $0.01 per request
        monthlyBudget: 200.00,
        cacheTtl: 1800, // 30 minutes
        enabled: true
      },
      {
        name: 'openai',
        maxRequestsPerMinute: 20,
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000,
        costPerRequest: 0.10, // $0.10 per request (varies by model)
        monthlyBudget: 1000.00,
        cacheTtl: 900, // 15 minutes for AI responses
        enabled: true
      },
      {
        name: 'postmark',
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 5000,
        maxRequestsPerDay: 50000,
        costPerRequest: 0.0015, // $0.0015 per email
        monthlyBudget: 100.00,
        cacheTtl: 0, // No caching for emails
        enabled: true
      },
      {
        name: 'zerobounce',
        maxRequestsPerMinute: 50,
        maxRequestsPerHour: 2000,
        maxRequestsPerDay: 20000,
        costPerRequest: 0.007, // $0.007 per verification
        monthlyBudget: 150.00,
        cacheTtl: 86400, // 24 hours - email verification is stable
        enabled: true
      }
    ];

    configs.forEach(config => {
      this.apiConfigs.set(config.name, config);
    });
  }

  /**
   * Check if API request is allowed and track usage
   */
  async checkRateLimit(userId: string, api: string, endpoint?: string): Promise<{
    allowed: boolean;
    status: RateLimitStatus;
    reason?: string;
    waitTime?: number;
  }> {
    try {
      const config = this.apiConfigs.get(api);
      if (!config || !config.enabled) {
        return {
          allowed: false,
          status: this.getEmptyStatus(api, userId),
          reason: `API ${api} is not configured or disabled`
        };
      }

      // Get or initialize user limits for this API
      const userApiLimits = this.getUserApiLimits(userId, api);
      const now = new Date();

      // Check minute limit
      if (userApiLimits.minute.count >= config.maxRequestsPerMinute) {
        const waitTime = 60 - now.getSeconds();
        return {
          allowed: false,
          status: this.getRateLimitStatus(userId, api),
          reason: 'Minute rate limit exceeded',
          waitTime
        };
      }

      // Check hour limit
      if (userApiLimits.hour.count >= config.maxRequestsPerHour) {
        const waitTime = (60 - now.getMinutes()) * 60 - now.getSeconds();
        return {
          allowed: false,
          status: this.getRateLimitStatus(userId, api),
          reason: 'Hourly rate limit exceeded',
          waitTime
        };
      }

      // Check daily limit
      if (userApiLimits.day.count >= config.maxRequestsPerDay) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const waitTime = (tomorrow.getTime() - now.getTime()) / 1000;
        return {
          allowed: false,
          status: this.getRateLimitStatus(userId, api),
          reason: 'Daily rate limit exceeded',
          waitTime
        };
      }

      // Check monthly budget
      const costMetrics = await this.getCostMetrics(userId, api);
      if (costMetrics.budgetUtilization >= 95) {
        return {
          allowed: false,
          status: this.getRateLimitStatus(userId, api),
          reason: 'Monthly budget limit approaching (95% used)'
        };
      }

      // All checks passed - increment counters
      this.incrementCounters(userId, api);

      return {
        allowed: true,
        status: this.getRateLimitStatus(userId, api)
      };

    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      return {
        allowed: false,
        status: this.getEmptyStatus(api, userId),
        reason: 'Rate limiter error'
      };
    }
  }

  /**
   * Track API usage and costs
   */
  async trackApiUsage(event: ApiUsageEvent): Promise<void> {
    try {
      const config = this.apiConfigs.get(event.api);
      if (!config) return;

      // Update cost tracking
      const userCosts = this.getUserCosts(event.userId, event.api);
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);

      // Daily costs
      if (!userCosts.daily[today]) {
        userCosts.daily[today] = { requests: 0, cost: 0 };
      }
      userCosts.daily[today].requests++;
      userCosts.daily[today].cost += event.cost;

      // Monthly costs
      if (!userCosts.monthly[thisMonth]) {
        userCosts.monthly[thisMonth] = { requests: 0, cost: 0 };
      }
      userCosts.monthly[thisMonth].requests++;
      userCosts.monthly[thisMonth].cost += event.cost;

      // Track cache hits
      if (event.cached) {
        const cacheKey = `${event.api}:hits`;
        this.cacheHits.set(cacheKey, (this.cacheHits.get(cacheKey) || 0) + 1);
      }

      // Store usage event for analytics
      await this.storeUsageEvent(event);

      console.log(`📊 API Usage tracked: ${event.api} - $${event.cost.toFixed(4)} - Cached: ${event.cached}`);

    } catch (error) {
      console.error('❌ Error tracking API usage:', error);
    }
  }

  /**
   * Get cost metrics for user and API
   */
  async getCostMetrics(userId: string, api: string): Promise<CostMetrics> {
    try {
      const config = this.apiConfigs.get(api);
      if (!config) {
        throw new Error(`API config not found: ${api}`);
      }

      const userCosts = this.getUserCosts(userId, api);
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);

      const dailyCosts = userCosts.daily[today] || { requests: 0, cost: 0 };
      const monthlyCosts = userCosts.monthly[thisMonth] || { requests: 0, cost: 0 };

      // Calculate year-to-date costs
      const yearToDate = this.calculateYearToDateCosts(userCosts);

      // Estimate monthly cost based on current usage
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const dayOfMonth = new Date().getDate();
      const estimatedMonthlyCost = (monthlyCosts.cost / dayOfMonth) * daysInMonth;

      // Calculate budget utilization
      const budgetUtilization = (monthlyCosts.cost / config.monthlyBudget) * 100;

      // Calculate cache savings
      const cacheHits = this.cacheHits.get(`${api}:hits`) || 0;
      const savingsFromCache = cacheHits * config.costPerRequest;

      return {
        api,
        userId,
        daily: dailyCosts,
        monthly: {
          requests: monthlyCosts.requests,
          cost: monthlyCosts.cost,
          budget: config.monthlyBudget
        },
        yearToDate,
        estimatedMonthlyCost,
        budgetUtilization,
        savingsFromCache
      };

    } catch (error) {
      console.error('❌ Error getting cost metrics:', error);
      throw error;
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(userId: string): Promise<Array<{
    type: 'warning' | 'info' | 'success';
    api: string;
    message: string;
    potentialSavings?: number;
    action?: string;
  }>> {
    try {
      const recommendations: Array<{
        type: 'warning' | 'info' | 'success';
        api: string;
        message: string;
        potentialSavings?: number;
        action?: string;
      }> = [];

      // Convert Map entries to array to avoid downlevelIteration requirement
      const apiEntries = Array.from(this.apiConfigs.entries());
      for (const [apiName, config] of apiEntries) {
        const metrics = await this.getCostMetrics(userId, apiName);

        // Budget utilization warnings
        if (metrics.budgetUtilization > 90) {
          recommendations.push({
            type: 'warning' as const,
            api: apiName,
            message: `Budget utilization at ${metrics.budgetUtilization.toFixed(1)}% - consider reducing usage`,
            action: 'Review recent API calls and implement caching'
          });
        } else if (metrics.budgetUtilization > 75) {
          recommendations.push({
            type: 'info' as const,
            api: apiName,
            message: `Budget utilization at ${metrics.budgetUtilization.toFixed(1)}% - monitor closely`,
            action: 'Enable more aggressive caching'
          });
        }

        // Cache optimization opportunities
        const cacheHitRate = this.calculateCacheHitRate(apiName);
        if (cacheHitRate < 50 && config.cacheTtl > 0) {
          const potentialSavings = metrics.monthly.cost * 0.3; // 30% potential savings
          recommendations.push({
            type: 'info' as const,
            api: apiName,
            message: `Low cache hit rate (${cacheHitRate.toFixed(1)}%) - optimize caching strategy`,
            potentialSavings,
            action: 'Increase cache TTL or improve cache key strategy'
          });
        }

        // Success stories
        if (metrics.savingsFromCache > 50) {
          recommendations.push({
            type: 'success' as const,
            api: apiName,
            message: `Excellent cache performance - saved $${metrics.savingsFromCache.toFixed(2)} this month`,
            potentialSavings: metrics.savingsFromCache
          });
        }
      }

      return recommendations.sort((a, b) => {
        const priority = { warning: 3, info: 2, success: 1 };
        return priority[b.type] - priority[a.type];
      });

    } catch (error) {
      console.error('❌ Error getting optimization recommendations:', error);
      return [];
    }
  }

  /**
   * Get comprehensive usage analytics
   */
  async getUsageAnalytics(userId: string, timeframe: 'day' | 'week' | 'month' = 'month'): Promise<{
    summary: {
      totalRequests: number;
      totalCost: number;
      averageCostPerRequest: number;
      cacheHitRate: number;
      topApi: string;
    };
    byApi: Array<{
      api: string;
      requests: number;
      cost: number;
      cacheHitRate: number;
      averageResponseTime: number;
    }>;
    timeline: Array<{
      date: string;
      requests: number;
      cost: number;
      cacheHits: number;
    }>;
    budgetStatus: Array<{
      api: string;
      used: number;
      budget: number;
      utilization: number;
      projectedOverage: number;
    }>;
  }> {
    try {
      // This would query real analytics data in production
      // For now, return comprehensive demo data

      const summary = {
        totalRequests: 15420,
        totalCost: 456.78,
        averageCostPerRequest: 0.0296,
        cacheHitRate: 73.2,
        topApi: 'apollo'
      };

      const byApi = [
        {
          api: 'apollo',
          requests: 6200,
          cost: 124.00,
          cacheHitRate: 68.5,
          averageResponseTime: 1.2
        },
        {
          api: 'openai',
          requests: 3400,
          cost: 340.00,
          cacheHitRate: 45.2,
          averageResponseTime: 2.8
        },
        {
          api: 'zoominfo',
          requests: 2100,
          cost: 105.00,
          cacheHitRate: 82.1,
          averageResponseTime: 1.8
        },
        {
          api: 'hunter',
          requests: 1800,
          cost: 18.00,
          cacheHitRate: 89.3,
          averageResponseTime: 0.9
        },
        {
          api: 'zerobounce',
          requests: 1520,
          cost: 10.64,
          cacheHitRate: 76.4,
          averageResponseTime: 1.1
        },
        {
          api: 'postmark',
          requests: 400,
          cost: 0.60,
          cacheHitRate: 0, // No caching for emails
          averageResponseTime: 0.5
        }
      ];

      const timeline = this.generateTimelineData(timeframe);
      const budgetStatus = await this.getBudgetStatus(userId);

      return {
        summary,
        byApi,
        timeline,
        budgetStatus
      };

    } catch (error) {
      console.error('❌ Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private getUserApiLimits(userId: string, api: string): any {
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, new Map());
    }

    const userLimits = this.userLimits.get(userId)!;
    if (!userLimits.has(api)) {
      const now = new Date();
      userLimits.set(api, {
        minute: { count: 0, resetAt: new Date(now.getTime() + 60000) },
        hour: { count: 0, resetAt: new Date(now.getTime() + 3600000) },
        day: { count: 0, resetAt: new Date(now.getTime() + 86400000) }
      });
    }

    return userLimits.get(api);
  }

  private getUserCosts(userId: string, api: string): any {
    if (!this.costTracker.has(userId)) {
      this.costTracker.set(userId, new Map());
    }

    const userCosts = this.costTracker.get(userId)!;
    if (!userCosts.has(api)) {
      userCosts.set(api, {
        daily: {},
        monthly: {},
        total: 0
      });
    }

    return userCosts.get(api);
  }

  private incrementCounters(userId: string, api: string): void {
    const limits = this.getUserApiLimits(userId, api);
    const now = new Date();

    // Reset counters if time windows have passed
    if (now > limits.minute.resetAt) {
      limits.minute.count = 0;
      limits.minute.resetAt = new Date(now.getTime() + 60000);
    }
    if (now > limits.hour.resetAt) {
      limits.hour.count = 0;
      limits.hour.resetAt = new Date(now.getTime() + 3600000);
    }
    if (now > limits.day.resetAt) {
      limits.day.count = 0;
      limits.day.resetAt = new Date(now.getTime() + 86400000);
    }

    // Increment counters
    limits.minute.count++;
    limits.hour.count++;
    limits.day.count++;
  }

  private getRateLimitStatus(userId: string, api: string): RateLimitStatus {
    const config = this.apiConfigs.get(api);
    const limits = this.getUserApiLimits(userId, api);

    if (!config) {
      return this.getEmptyStatus(api, userId);
    }

    const now = new Date();
    return {
      api,
      userId,
      minute: {
        used: limits.minute.count,
        limit: config.maxRequestsPerMinute,
        resetAt: limits.minute.resetAt
      },
      hour: {
        used: limits.hour.count,
        limit: config.maxRequestsPerHour,
        resetAt: limits.hour.resetAt
      },
      day: {
        used: limits.day.count,
        limit: config.maxRequestsPerDay,
        resetAt: limits.day.resetAt
      },
      month: {
        used: 0, // Would be calculated from cost tracking
        limit: config.monthlyBudget,
        resetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      },
      isBlocked: false
    };
  }

  private getEmptyStatus(api: string, userId: string): RateLimitStatus {
    const now = new Date();
    return {
      api,
      userId,
      minute: { used: 0, limit: 0, resetAt: now },
      hour: { used: 0, limit: 0, resetAt: now },
      day: { used: 0, limit: 0, resetAt: now },
      month: { used: 0, limit: 0, resetAt: now },
      isBlocked: true,
      blockReason: 'API not configured'
    };
  }

  private calculateYearToDateCosts(userCosts: any): { requests: number; cost: number } {
    const currentYear = new Date().getFullYear().toString();
    let requests = 0;
    let cost = 0;

    for (const [month, data] of Object.entries(userCosts.monthly)) {
      if (month.startsWith(currentYear)) {
        requests += (data as any).requests;
        cost += (data as any).cost;
      }
    }

    return { requests, cost };
  }

  private calculateCacheHitRate(api: string): number {
    const cacheHits = this.cacheHits.get(`${api}:hits`) || 0;
    const totalRequests = this.cacheHits.get(`${api}:total`) || 1;
    return (cacheHits / totalRequests) * 100;
  }

  private generateTimelineData(timeframe: string): any[] {
    const days = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
    const timeline = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      timeline.push({
        date: date.toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 500) + 100,
        cost: Math.random() * 20 + 5,
        cacheHits: Math.floor(Math.random() * 300) + 50
      });
    }

    return timeline;
  }

  private async getBudgetStatus(userId: string): Promise<any[]> {
    const status = [];

    for (const [apiName, config] of Array.from(this.apiConfigs.entries())) {
      const metrics = await this.getCostMetrics(userId, apiName);
      
      status.push({
        api: apiName,
        used: metrics.monthly.cost,
        budget: config.monthlyBudget,
        utilization: metrics.budgetUtilization,
        projectedOverage: Math.max(0, metrics.estimatedMonthlyCost - config.monthlyBudget)
      });
    }

    return status;
  }

  private async storeUsageEvent(event: ApiUsageEvent): Promise<void> {
    // In production, this would store in database
    console.log('📝 Storing usage event:', {
      api: event.api,
      cost: event.cost,
      cached: event.cached,
      timestamp: event.timestamp
    });
  }

  private startCleanupTimer(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    // In production, this would clean up old tracking data
    console.log('🧹 Cleaning up rate limit data older than', cutoff);
  }
}

export const apiRateLimiter = new ApiRateLimiter();