import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';

// Extended Request interface to include custom properties
interface ApiRequest extends Request {
  requestId?: string;
  startTime?: number;
  user?: any;
  apiKey?: string;
  clientInfo?: {
    ip: string;
    userAgent: string;
    origin?: string;
  };
}

interface ApiResponse extends Response {
  locals: {
    requestId?: string;
    responseTime?: number;
    statusMessage?: string;
  };
}

/**
 * API Gateway Middleware Stack
 * Provides comprehensive request routing, authentication, rate limiting, 
 * monitoring, and analytics for the lead generation platform
 */
export class ApiGateway {
  private static instance: ApiGateway;
  private requestMetrics: Map<string, any> = new Map();
  private rateLimitStore: Map<string, any> = new Map();

  public static getInstance(): ApiGateway {
    if (!ApiGateway.instance) {
      ApiGateway.instance = new ApiGateway();
    }
    return ApiGateway.instance;
  }

  /**
   * Initialize API Gateway middleware stack
   */
  public initializeMiddleware(app: express.Application): void {
    console.log('🌐 Initializing API Gateway middleware stack...');

    // Security middleware
    this.setupSecurity(app);

    // Request preprocessing
    this.setupPreprocessing(app);

    // Rate limiting
    this.setupRateLimiting(app);

    // Authentication middleware
    this.setupAuthentication(app);

    // Request/Response logging
    this.setupLogging(app);

    // Monitoring and analytics
    this.setupMonitoring(app);

    console.log('✅ API Gateway initialized successfully');
  }

  /**
   * Security middleware setup
   */
  private setupSecurity(app: express.Application): void {
    // CORS configuration
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, postman, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost and replit domains
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:5000',
          'https://replit.app',
          'https://replit.dev',
          /\.replit\.app$/,
          /\.replit\.dev$/,
        ];

        const isAllowed = allowedOrigins.some(allowed => 
          typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
        );

        callback(null, isAllowed);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-Response-Time'],
    };

    app.use(cors(corsOptions));

    // Security headers with Helmet
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          connectSrc: ["'self'", "https:", "wss:", "ws:"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Compression middleware
    app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
  }

  /**
   * Request preprocessing middleware
   */
  private setupPreprocessing(app: express.Application): void {
    app.use((req: ApiRequest, res: ApiResponse, next: NextFunction) => {
      // Generate unique request ID
      req.requestId = req.headers['x-request-id'] as string || uuidv4();
      res.setHeader('X-Request-ID', req.requestId);
      res.locals.requestId = req.requestId;

      // Track request start time
      req.startTime = Date.now();

      // Extract client information
      req.clientInfo = {
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        origin: req.headers.origin
      };

      // Parse JSON bodies with error handling
      if (req.is('application/json')) {
        express.json({ limit: '10mb' })(req, res, (err) => {
          if (err) {
            return res.status(400).json({
              error: 'Invalid JSON payload',
              requestId: req.requestId,
              timestamp: new Date().toISOString()
            });
          }
          next();
        });
      } else {
        next();
      }
    });
  }

  /**
   * Rate limiting configuration
   */
  private setupRateLimiting(app: express.Application): void {
    // General API rate limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: ApiRequest) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.clientInfo?.ip || 'unknown';
      },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      }
    });

    // Strict rate limiting for sensitive endpoints
    const strictLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 100, // limit each user to 100 requests per hour
      message: {
        error: 'Rate limit exceeded for sensitive operations',
        retryAfter: '1 hour',
        timestamp: new Date().toISOString()
      },
      keyGenerator: (req: ApiRequest) => req.user?.id || req.clientInfo?.ip || 'unknown'
    });

    // AI API rate limiting
    const aiLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 500, // 500 AI requests per hour per user
      message: {
        error: 'AI API rate limit exceeded',
        retryAfter: '1 hour',
        remainingQuota: 0,
        timestamp: new Date().toISOString()
      },
      keyGenerator: (req: ApiRequest) => `ai:${req.user?.id || req.clientInfo?.ip}`
    });

    // Apply rate limiters
    app.use('/api', generalLimiter);
    app.use('/api/auth', strictLimiter);
    app.use('/api/admin', strictLimiter);
    app.use('/api/ai', aiLimiter);
    app.use('/api/prospects/enrich', aiLimiter);
    app.use('/api/messages/generate', aiLimiter);
  }

  /**
   * Authentication and authorization middleware
   */
  private setupAuthentication(app: express.Application): void {
    // API Key authentication middleware
    const apiKeyAuth = (req: ApiRequest, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (apiKey) {
        // Validate API key format and store it
        if (this.validateApiKey(apiKey)) {
          req.apiKey = apiKey;
          next();
        } else {
          return res.status(401).json({
            error: 'Invalid API key',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        next();
      }
    };

    // Role-based access control
    const requireRole = (roles: string[]) => {
      return (req: ApiRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            requestId: req.requestId
          });
        }

        const userRole = req.user.role || 'user';
        if (!roles.includes(userRole)) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            requiredRoles: roles,
            userRole,
            requestId: req.requestId
          });
        }

        next();
      };
    };

    // Apply authentication middleware
    app.use('/api', apiKeyAuth);

    // Admin routes require admin role
    app.use('/api/admin', requireRole(['admin']));
  }

  /**
   * Request/Response logging middleware
   */
  private setupLogging(app: express.Application): void {
    app.use((req: ApiRequest, res: ApiResponse, next: NextFunction) => {
      const originalSend = res.send;
      
      // Store reference to gateway instance for use in closure
      const gateway = this;
      
      // Override res.send to capture response data
      res.send = function(data: any) {
        const responseTime = Date.now() - (req.startTime || Date.now());
        res.locals.responseTime = responseTime;
        
        // Log request/response details
        const logData = {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.headers['user-agent'],
          ip: req.clientInfo?.ip,
          userId: req.user?.id,
          timestamp: new Date().toISOString(),
          requestSize: req.headers['content-length'] || 0,
          responseSize: Buffer.byteLength(data || '', 'utf8')
        };

        // Store metrics for analytics
        gateway.storeRequestMetrics(logData);

        // Log to console (in production, use proper logging service)
        console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`);

        // Set response time header
        res.setHeader('X-Response-Time', `${responseTime}ms`);

        return originalSend.call(this, data);
      }.bind(res);

      next();
    });
  }

  /**
   * Monitoring and analytics setup
   */
  private setupMonitoring(app: express.Application): void {
    // Health check endpoint
    app.get('/health', (req: ApiRequest, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        requestId: req.requestId
      });
    });

    // API metrics endpoint
    app.get('/api/metrics', (req: ApiRequest, res: Response) => {
      const metrics = this.getApiMetrics();
      res.json({
        ...metrics,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    });

    // Error handling middleware
    app.use((error: Error, req: ApiRequest, res: ApiResponse, next: NextFunction) => {
      const errorId = uuidv4();
      
      console.error(`[ERROR ${errorId}] ${error.message}`, {
        requestId: req.requestId,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        errorId,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Validate API key format and authenticity
   */
  private validateApiKey(apiKey: string): boolean {
    // Basic validation - in production, validate against database
    return /^[a-zA-Z0-9]{32,}$/.test(apiKey);
  }

  /**
   * Store request metrics for analytics
   */
  private storeRequestMetrics(logData: any): void {
    const key = `${logData.method}:${logData.url}`;
    
    if (!this.requestMetrics.has(key)) {
      this.requestMetrics.set(key, {
        count: 0,
        totalResponseTime: 0,
        errors: 0,
        lastRequest: null
      });
    }

    const metrics = this.requestMetrics.get(key);
    metrics.count++;
    metrics.totalResponseTime += logData.responseTime;
    metrics.lastRequest = logData.timestamp;

    if (logData.statusCode >= 400) {
      metrics.errors++;
    }

    // Keep only last 1000 endpoints to prevent memory leaks
    if (this.requestMetrics.size > 1000) {
      const firstKey = this.requestMetrics.keys().next().value;
      if (firstKey) {
        this.requestMetrics.delete(firstKey);
      }
    }
  }

  /**
   * Get comprehensive API metrics
   */
  private getApiMetrics(): any {
    const now = Date.now();
    const metrics = {
      totalRequests: 0,
      totalResponseTime: 0,
      errorRate: 0,
      averageResponseTime: 0,
      endpoints: Array.from(this.requestMetrics.entries()).map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        averageResponseTime: Math.round(data.totalResponseTime / data.count),
        errorCount: data.errors,
        errorRate: Math.round((data.errors / data.count) * 100),
        lastRequest: data.lastRequest
      }))
    };

    // Calculate totals
    metrics.endpoints.forEach(endpoint => {
      metrics.totalRequests += endpoint.count;
      metrics.totalResponseTime += endpoint.count * endpoint.averageResponseTime;
    });

    metrics.averageResponseTime = metrics.totalRequests > 0 
      ? Math.round(metrics.totalResponseTime / metrics.totalRequests) 
      : 0;

    const totalErrors = metrics.endpoints.reduce((sum, ep) => sum + ep.errorCount, 0);
    metrics.errorRate = metrics.totalRequests > 0 
      ? Math.round((totalErrors / metrics.totalRequests) * 100) 
      : 0;

    return metrics;
  }

  /**
   * Get current rate limit status for a user/IP
   */
  public getRateLimitStatus(identifier: string): any {
    return {
      identifier,
      limits: {
        general: { max: 1000, window: '15 minutes' },
        ai: { max: 500, window: '1 hour' },
        auth: { max: 100, window: '1 hour' }
      },
      current: {
        general: 0, // Would be tracked in real implementation
        ai: 0,
        auth: 0
      }
    };
  }
}

export const apiGateway = ApiGateway.getInstance();