import { Request, Response, NextFunction } from 'express';
import * as os from 'os';
import { performance } from 'perf_hooks';

/**
 * API Monitoring and Analytics System
 * Provides comprehensive monitoring, metrics collection, and performance tracking
 */
export class ApiMonitoring {
  private static instance: ApiMonitoring;
  private metrics: Map<string, any> = new Map();
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();
  private alertThresholds = {
    responseTime: 5000, // 5 seconds
    errorRate: 10, // 10%
    memoryUsage: 0.9, // 90%
    cpuUsage: 0.8 // 80%
  };

  public static getInstance(): ApiMonitoring {
    if (!ApiMonitoring.instance) {
      ApiMonitoring.instance = new ApiMonitoring();
    }
    return ApiMonitoring.instance;
  }

  /**
   * Initialize monitoring system
   */
  public initialize(): void {
    console.log('📊 Initializing API monitoring system...');
    
    this.setupDefaultHealthChecks();
    this.startMetricsCollection();
    
    console.log('✅ API monitoring system initialized');
  }

  /**
   * Monitoring middleware for requests
   */
  public monitorRequest() {
    return (req: Request & { startTime?: number; requestId?: string }, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      req.startTime = startTime;

      // Override res.json to capture response data
      const originalJson = res.json;
      res.json = function(data: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Record metrics
        const metricsData = {
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          requestId: req.requestId
        };

        ApiMonitoring.getInstance().recordMetric(metricsData);
        
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Record API metrics
   */
  public recordMetric(data: any): void {
    const key = `${data.method}:${data.path}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalResponseTime: 0,
        errors: 0,
        successCount: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        recentRequests: []
      });
    }

    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalResponseTime += data.responseTime;
    metric.minResponseTime = Math.min(metric.minResponseTime, data.responseTime);
    metric.maxResponseTime = Math.max(metric.maxResponseTime, data.responseTime);

    if (data.statusCode >= 400) {
      metric.errors++;
    } else {
      metric.successCount++;
    }

    // Keep recent requests for analysis
    metric.recentRequests.push({
      timestamp: data.timestamp,
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      ip: data.ip
    });

    // Keep only last 100 requests
    if (metric.recentRequests.length > 100) {
      metric.recentRequests.shift();
    }

    // Check for alerts
    this.checkAlerts(key, metric);
  }

  /**
   * Get comprehensive API metrics
   */
  public getMetrics(): any {
    const now = Date.now();
    const systemMetrics = this.getSystemMetrics();
    
    const apiMetrics = Array.from(this.metrics.entries()).map(([endpoint, data]) => {
      const errorRate = data.count > 0 ? (data.errors / data.count) * 100 : 0;
      const averageResponseTime = data.count > 0 ? data.totalResponseTime / data.count : 0;
      
      return {
        endpoint,
        requests: data.count,
        successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
        errorRate,
        averageResponseTime: Math.round(averageResponseTime),
        minResponseTime: data.minResponseTime === Infinity ? 0 : Math.round(data.minResponseTime),
        maxResponseTime: Math.round(data.maxResponseTime),
        recentActivity: data.recentRequests.slice(-10)
      };
    }).sort((a, b) => b.requests - a.requests);

    const totalRequests = apiMetrics.reduce((sum, metric) => sum + metric.requests, 0);
    const totalErrors = apiMetrics.reduce((sum, metric) => sum + (metric.requests * metric.errorRate / 100), 0);
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: systemMetrics,
      api: {
        totalRequests,
        overallErrorRate: Math.round(overallErrorRate * 100) / 100,
        endpoints: apiMetrics,
        healthChecks: this.runHealthChecks()
      },
      performance: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime()),
      loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0]
    };
  }

  /**
   * Setup default health checks
   */
  private setupDefaultHealthChecks(): void {
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        // Check database connection
        const { db } = await import('../db');
        await db.execute('SELECT 1');
        return true;
      } catch (error) {
        console.error('Database health check failed:', error);
        return false;
      }
    });

    // AI Service health check
    this.healthChecks.set('ai-service', async () => {
      try {
        const { pythonAI } = await import('../services/pythonAiClient');
        return await pythonAI.healthCheck();
      } catch (error) {
        console.error('AI service health check failed:', error);
        return false;
      }
    });

    // Memory health check
    this.healthChecks.set('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
      return heapUsagePercent < this.alertThresholds.memoryUsage;
    });

    // External APIs health check
    this.healthChecks.set('external-apis', async () => {
      try {
        // Check critical external services
        const checks = await Promise.allSettled([
          this.checkApolloAPI(),
          this.checkTwilioAPI(),
          this.checkPostmarkAPI()
        ]);

        // Return true if at least one service is working
        return checks.some(result => result.status === 'fulfilled' && result.value === true);
      } catch (error) {
        console.error('External APIs health check failed:', error);
        return false;
      }
    });
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const [name, check] of this.healthChecks.entries()) {
      try {
        const startTime = performance.now();
        const isHealthy = await Promise.race([
          check(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        const responseTime = performance.now() - startTime;
        
        results[name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime: Math.round(responseTime),
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          error: (error as Error).message,
          lastCheck: new Date().toISOString()
        };
      }
    }
    
    return results;
  }

  /**
   * Check Apollo API health
   */
  private async checkApolloAPI(): Promise<boolean> {
    if (!process.env.APOLLO_API_KEY) return false;
    
    try {
      const response = await fetch('https://api.apollo.io/v1/auth/health', {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.APOLLO_API_KEY
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Twilio API health
   */
  private async checkTwilioAPI(): Promise<boolean> {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false;
    
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Postmark API health
   */
  private async checkPostmarkAPI(): Promise<boolean> {
    if (!process.env.POSTMARK_SERVER_API) return false;
    
    try {
      const response = await fetch('https://api.postmarkapp.com/servers', {
        headers: {
          'X-Postmark-Account-Token': process.env.POSTMARK_SERVER_API,
          'Accept': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for alerts based on metrics
   */
  private checkAlerts(endpoint: string, metric: any): void {
    const errorRate = metric.count > 0 ? (metric.errors / metric.count) * 100 : 0;
    const avgResponseTime = metric.count > 0 ? metric.totalResponseTime / metric.count : 0;

    // Response time alert
    if (avgResponseTime > this.alertThresholds.responseTime) {
      this.triggerAlert('high-response-time', {
        endpoint,
        responseTime: avgResponseTime,
        threshold: this.alertThresholds.responseTime
      });
    }

    // Error rate alert
    if (errorRate > this.alertThresholds.errorRate) {
      this.triggerAlert('high-error-rate', {
        endpoint,
        errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(type: string, data: any): void {
    console.warn(`🚨 ALERT [${type}]:`, data);
    
    // In production, send to monitoring service like DataDog, New Relic, etc.
    // For now, just log to console
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute

    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
  }

  /**
   * Collect system metrics periodically
   */
  private collectSystemMetrics(): void {
    const metrics = this.getSystemMetrics();
    
    // Check memory usage alert
    const memoryUsagePercent = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (memoryUsagePercent > this.alertThresholds.memoryUsage) {
      this.triggerAlert('high-memory-usage', {
        current: Math.round(memoryUsagePercent * 100),
        threshold: Math.round(this.alertThresholds.memoryUsage * 100)
      });
    }
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;

    for (const [key, metric] of this.metrics.entries()) {
      metric.recentRequests = metric.recentRequests.filter(
        (req: any) => new Date(req.timestamp).getTime() > cutoff
      );

      // Remove metrics with no recent activity
      if (metric.recentRequests.length === 0 && metric.count > 0) {
        // Reset counters but keep the endpoint
        metric.count = 0;
        metric.totalResponseTime = 0;
        metric.errors = 0;
        metric.successCount = 0;
        metric.minResponseTime = Infinity;
        metric.maxResponseTime = 0;
      }
    }
  }

  /**
   * Add custom health check
   */
  public addHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Remove health check
   */
  public removeHealthCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  /**
   * Get alert thresholds
   */
  public getAlertThresholds(): any {
    return { ...this.alertThresholds };
  }

  /**
   * Update alert thresholds
   */
  public updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }
}

export const apiMonitoring = ApiMonitoring.getInstance();