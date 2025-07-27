/**
 * Cost Optimization Service (CARD-013)
 * Intelligent caching strategies and cost reduction recommendations
 */

import { apiRateLimiter, ApiUsageEvent, CostMetrics } from './apiRateLimiter';

export interface CacheStrategy {
  api: string;
  strategy: 'aggressive' | 'balanced' | 'conservative';
  ttl: number;
  keyPattern: string;
  hitRate: number;
  savings: number;
}

export interface OptimizationAlert {
  id: string;
  type: 'budget' | 'performance' | 'cache' | 'usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  api: string;
  message: string;
  recommendation: string;
  potentialSavings: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface BudgetAlert {
  userId: string;
  api: string;
  currentSpend: number;
  budget: number;
  utilizationPercent: number;
  projectedMonthlySpend: number;
  daysUntilBudgetExhausted: number;
  alertLevel: 'warning' | 'critical';
}

export class CostOptimizer {
  private cacheStrategies: Map<string, CacheStrategy> = new Map();
  private alerts: Map<string, OptimizationAlert[]> = new Map(); // userId -> alerts
  private budgetThresholds = {
    warning: 75, // 75% budget utilization
    critical: 90  // 90% budget utilization
  };

  constructor() {
    this.initializeCacheStrategies();
    this.startOptimizationMonitoring();
    console.log('💰 Cost Optimizer initialized');
  }

  /**
   * Initialize cache strategies for different APIs
   */
  private initializeCacheStrategies(): void {
    const strategies: CacheStrategy[] = [
      {
        api: 'apollo',
        strategy: 'balanced',
        ttl: 3600, // 1 hour
        keyPattern: 'apollo:search:{query_hash}',
        hitRate: 68.5,
        savings: 856.32
      },
      {
        api: 'zoominfo',
        strategy: 'aggressive',
        ttl: 7200, // 2 hours
        keyPattern: 'zoominfo:company:{domain}',
        hitRate: 82.1,
        savings: 1245.67
      },
      {
        api: 'hunter',
        strategy: 'balanced',
        ttl: 1800, // 30 minutes
        keyPattern: 'hunter:email:{domain}',
        hitRate: 89.3,
        savings: 432.10
      },
      {
        api: 'openai',
        strategy: 'conservative',
        ttl: 900, // 15 minutes for AI responses
        keyPattern: 'openai:completion:{prompt_hash}',
        hitRate: 45.2,
        savings: 2156.78
      },
      {
        api: 'zerobounce',
        strategy: 'aggressive',
        ttl: 86400, // 24 hours - email verification is stable
        keyPattern: 'zerobounce:verify:{email}',
        hitRate: 76.4,
        savings: 234.56
      }
    ];

    strategies.forEach(strategy => {
      this.cacheStrategies.set(strategy.api, strategy);
    });
  }

  /**
   * Analyze API usage and generate optimization recommendations
   */
  async analyzeUsagePatterns(userId: string, timeframe: 'week' | 'month' = 'month'): Promise<{
    patterns: Array<{
      api: string;
      peakHours: number[];
      averageRequestsPerDay: number;
      costTrend: 'increasing' | 'decreasing' | 'stable';
      optimizationPotential: 'high' | 'medium' | 'low';
    }>;
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      action: string;
      expectedSavings: number;
      implementationEffort: 'easy' | 'medium' | 'complex';
    }>;
    cacheOpportunities: Array<{
      api: string;
      currentHitRate: number;
      targetHitRate: number;
      potentialSavings: number;
      cacheStrategy: string;
    }>;
  }> {
    try {
      const analytics = await apiRateLimiter.getUsageAnalytics(userId, timeframe);

      // Analyze usage patterns
      const patterns = analytics.byApi.map(apiData => ({
        api: apiData.api,
        peakHours: this.identifyPeakHours(apiData.api),
        averageRequestsPerDay: Math.round(apiData.requests / 30),
        costTrend: this.analyzeCostTrend(apiData.api) as 'increasing' | 'decreasing' | 'stable',
        optimizationPotential: this.assessOptimizationPotential(apiData) as 'high' | 'medium' | 'low'
      }));

      // Generate recommendations
      const recommendations = await this.generateOptimizationRecommendations(analytics);

      // Identify cache opportunities
      const cacheOpportunities = analytics.byApi
        .filter(api => api.cacheHitRate < 80)
        .map(apiData => ({
          api: apiData.api,
          currentHitRate: apiData.cacheHitRate,
          targetHitRate: 85,
          potentialSavings: this.calculateCacheSavings(apiData),
          cacheStrategy: this.recommendCacheStrategy(apiData.api)
        }));

      return {
        patterns,
        recommendations,
        cacheOpportunities
      };

    } catch (error) {
      console.error('❌ Error analyzing usage patterns:', error);
      throw error;
    }
  }

  /**
   * Monitor budgets and generate alerts
   */
  async monitorBudgets(userId: string): Promise<BudgetAlert[]> {
    try {
      const alerts: BudgetAlert[] = [];
      const analytics = await apiRateLimiter.getUsageAnalytics(userId);

      for (const budgetInfo of analytics.budgetStatus) {
        if (budgetInfo.utilization >= this.budgetThresholds.warning) {
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          const dayOfMonth = new Date().getDate();
          const dailySpendRate = budgetInfo.used / dayOfMonth;
          const projectedMonthlySpend = dailySpendRate * daysInMonth;
          const remainingBudget = budgetInfo.budget - budgetInfo.used;
          const daysUntilExhausted = Math.floor(remainingBudget / dailySpendRate);

          alerts.push({
            userId,
            api: budgetInfo.api,
            currentSpend: budgetInfo.used,
            budget: budgetInfo.budget,
            utilizationPercent: budgetInfo.utilization,
            projectedMonthlySpend,
            daysUntilBudgetExhausted: daysUntilExhausted,
            alertLevel: budgetInfo.utilization >= this.budgetThresholds.critical ? 'critical' : 'warning'
          });
        }
      }

      // Store alerts for user
      if (alerts.length > 0) {
        await this.storeOptimizationAlerts(userId, alerts);
      }

      return alerts;

    } catch (error) {
      console.error('❌ Error monitoring budgets:', error);
      return [];
    }
  }

  /**
   * Get comprehensive cost optimization dashboard data
   */
  async getCostDashboard(userId: string): Promise<{
    summary: {
      totalMonthlyCost: number;
      totalBudget: number;
      projectedSavings: number;
      cacheEfficiency: number;
    };
    alerts: OptimizationAlert[];
    budgetStatus: BudgetAlert[];
    topSavingsOpportunities: Array<{
      api: string;
      opportunity: string;
      potentialSavings: number;
      effort: string;
    }>;
    performanceMetrics: {
      averageResponseTime: number;
      cacheHitRate: number;
      costPerRequest: number;
      requestsPerDollar: number;
    };
  }> {
    try {
      const analytics = await apiRateLimiter.getUsageAnalytics(userId);
      const budgetAlerts = await this.monitorBudgets(userId);
      const usageAnalysis = await this.analyzeUsagePatterns(userId);

      // Calculate summary metrics
      const totalMonthlyCost = analytics.summary.totalCost;
      const totalBudget = analytics.budgetStatus.reduce((sum, b) => sum + b.budget, 0);
      const projectedSavings = usageAnalysis.cacheOpportunities.reduce((sum, c) => sum + c.potentialSavings, 0);
      const cacheEfficiency = analytics.summary.cacheHitRate;

      // Get user alerts
      const userAlerts = this.alerts.get(userId) || [];

      // Top savings opportunities
      const topSavingsOpportunities = usageAnalysis.recommendations
        .filter(r => r.priority === 'high')
        .slice(0, 5)
        .map(r => ({
          api: 'multiple',
          opportunity: r.action,
          potentialSavings: r.expectedSavings,
          effort: r.implementationEffort
        }));

      // Performance metrics
      const performanceMetrics = {
        averageResponseTime: analytics.byApi.reduce((sum, api) => sum + api.averageResponseTime, 0) / analytics.byApi.length,
        cacheHitRate: analytics.summary.cacheHitRate,
        costPerRequest: analytics.summary.averageCostPerRequest,
        requestsPerDollar: 1 / analytics.summary.averageCostPerRequest
      };

      return {
        summary: {
          totalMonthlyCost,
          totalBudget,
          projectedSavings,
          cacheEfficiency
        },
        alerts: userAlerts,
        budgetStatus: budgetAlerts,
        topSavingsOpportunities,
        performanceMetrics
      };

    } catch (error) {
      console.error('❌ Error getting cost dashboard:', error);
      throw error;
    }
  }

  /**
   * Optimize cache configuration for an API
   */
  async optimizeCacheConfiguration(api: string, targetSavings: number): Promise<{
    currentStrategy: CacheStrategy;
    recommendedStrategy: CacheStrategy;
    expectedSavings: number;
    implementationSteps: string[];
  }> {
    try {
      const currentStrategy = this.cacheStrategies.get(api);
      if (!currentStrategy) {
        throw new Error(`No cache strategy found for API: ${api}`);
      }

      // Calculate recommended strategy based on target savings
      const recommendedStrategy: CacheStrategy = {
        ...currentStrategy,
        strategy: targetSavings > 1000 ? 'aggressive' : targetSavings > 500 ? 'balanced' : 'conservative',
        ttl: this.calculateOptimalTTL(api, targetSavings),
        hitRate: Math.min(95, currentStrategy.hitRate + 15), // Target 15% improvement
        savings: currentStrategy.savings + targetSavings
      };

      const implementationSteps = [
        `Update cache TTL from ${currentStrategy.ttl}s to ${recommendedStrategy.ttl}s`,
        `Implement ${recommendedStrategy.strategy} caching strategy`,
        `Update cache key pattern to ${recommendedStrategy.keyPattern}`,
        'Monitor cache hit rate for 48 hours',
        'Adjust TTL based on performance metrics'
      ];

      return {
        currentStrategy,
        recommendedStrategy,
        expectedSavings: targetSavings,
        implementationSteps
      };

    } catch (error) {
      console.error('❌ Error optimizing cache configuration:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private identifyPeakHours(api: string): number[] {
    // In production, this would analyze real usage data
    // Return typical business hours as peak times
    return [9, 10, 11, 14, 15, 16];
  }

  private analyzeCostTrend(api: string): string {
    // In production, this would analyze historical cost data
    const trends = ['increasing', 'decreasing', 'stable'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  private assessOptimizationPotential(apiData: any): string {
    if (apiData.cacheHitRate < 50 || apiData.cost > 100) {
      return 'high';
    } else if (apiData.cacheHitRate < 70 || apiData.cost > 50) {
      return 'medium';
    }
    return 'low';
  }

  private async generateOptimizationRecommendations(analytics: any): Promise<any[]> {
    const recommendations = [];

    // High-impact recommendations
    if (analytics.summary.cacheHitRate < 60) {
      recommendations.push({
        priority: 'high',
        action: 'Implement aggressive caching for frequently accessed data',
        expectedSavings: 500,
        implementationEffort: 'medium'
      });
    }

    // API-specific recommendations
    for (const apiData of analytics.byApi) {
      if (apiData.cost > 200 && apiData.cacheHitRate < 70) {
        recommendations.push({
          priority: 'high',
          action: `Optimize ${apiData.api} caching strategy - current hit rate: ${apiData.cacheHitRate.toFixed(1)}%`,
          expectedSavings: apiData.cost * 0.3,
          implementationEffort: 'easy'
        });
      }
    }

    // Budget optimization
    if (analytics.summary.totalCost > 800) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider batch processing to reduce per-request costs',
        expectedSavings: 150,
        implementationEffort: 'complex'
      });
    }

    return recommendations;
  }

  private calculateCacheSavings(apiData: any): number {
    const improvementPotential = (85 - apiData.cacheHitRate) / 100;
    return apiData.cost * improvementPotential * 0.8; // 80% of potential savings
  }

  private recommendCacheStrategy(api: string): string {
    const strategy = this.cacheStrategies.get(api);
    return strategy ? strategy.strategy : 'balanced';
  }

  private calculateOptimalTTL(api: string, targetSavings: number): number {
    const baseStrategy = this.cacheStrategies.get(api);
    if (!baseStrategy) return 3600;

    // Increase TTL based on target savings
    const multiplier = targetSavings > 1000 ? 2 : targetSavings > 500 ? 1.5 : 1.2;
    return Math.min(baseStrategy.ttl * multiplier, 86400); // Max 24 hours
  }

  private async storeOptimizationAlerts(userId: string, budgetAlerts: BudgetAlert[]): Promise<void> {
    const optimizationAlerts: OptimizationAlert[] = budgetAlerts.map(alert => ({
      id: `budget_${alert.api}_${Date.now()}`,
      type: 'budget',
      severity: alert.alertLevel === 'critical' ? 'critical' : 'high',
      api: alert.api,
      message: `${alert.api} budget ${alert.utilizationPercent.toFixed(1)}% utilized`,
      recommendation: alert.alertLevel === 'critical' 
        ? 'Immediate action required - consider pausing non-essential requests'
        : 'Enable aggressive caching and review usage patterns',
      potentialSavings: alert.budget - alert.currentSpend,
      timestamp: new Date(),
      acknowledged: false
    }));

    if (!this.alerts.has(userId)) {
      this.alerts.set(userId, []);
    }
    this.alerts.get(userId)!.push(...optimizationAlerts);
  }

  private startOptimizationMonitoring(): void {
    // Monitor every 15 minutes
    setInterval(async () => {
      await this.runOptimizationChecks();
    }, 15 * 60 * 1000);
  }

  private async runOptimizationChecks(): Promise<void> {
    try {
      // In production, this would iterate through all active users
      // For now, just log that monitoring is running
      console.log('🔍 Running cost optimization checks...');
    } catch (error) {
      console.error('❌ Error in optimization monitoring:', error);
    }
  }
}

export const costOptimizer = new CostOptimizer();