import axios, { AxiosInstance, AxiosError } from 'axios';
import { cacheService } from './cacheService';
import * as crypto from 'crypto';

/**
 * ZeroBounce API Client
 * Comprehensive email verification service with caching and rate limiting
 */
export class ZeroBounceClient {
  private static instance: ZeroBounceClient;
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://api.zerobounce.net/v2';
  private isConfigured: boolean = false;

  // Rate limiting configuration
  private requestCounts: Map<string, number> = new Map();
  private rateLimitWindow = 60000; // 1 minute
  private maxRequestsPerMinute = 100;

  private constructor() {
    this.apiKey = process.env.ZEROBOUNCE_API_KEY || '';
    this.isConfigured = !!this.apiKey;
    
    if (this.isConfigured) {
      this.initializeClient();
      console.log('✅ ZeroBounce client initialized');
    } else {
      console.log('⚠️ ZeroBounce API key not configured');
    }
  }

  public static getInstance(): ZeroBounceClient {
    if (!ZeroBounceClient.instance) {
      ZeroBounceClient.instance = new ZeroBounceClient();
    }
    return ZeroBounceClient.instance;
  }

  /**
   * Initialize HTTP client
   */
  private initializeClient(): void {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'LeadGen-Platform/1.0',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`📧 ZeroBounce API request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ ZeroBounce request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Handle API errors with detailed logging
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      
      switch (status) {
        case 401:
          console.error('❌ ZeroBounce: Invalid API key');
          break;
        case 402:
          console.error('❌ ZeroBounce: Insufficient credits');
          break;
        case 429:
          console.error('❌ ZeroBounce: Rate limit exceeded');
          break;
        case 500:
          console.error('❌ ZeroBounce: Server error');
          break;
        default:
          console.error(`❌ ZeroBounce error ${status}:`, data?.error || error.message);
      }
    } else {
      console.error('❌ ZeroBounce network error:', error.message);
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowKey = Math.floor(now / this.rateLimitWindow).toString();
    
    const currentCount = this.requestCounts.get(windowKey) || 0;
    
    if (currentCount >= this.maxRequestsPerMinute) {
      console.warn('⚠️ ZeroBounce rate limit exceeded');
      return false;
    }
    
    this.requestCounts.set(windowKey, currentCount + 1);
    
    // Clean up old entries
    for (const [key, _] of this.requestCounts) {
      if (parseInt(key) < Math.floor(now / this.rateLimitWindow) - 1) {
        this.requestCounts.delete(key);
      }
    }
    
    return true;
  }

  /**
   * Generate cache key for email verification
   */
  private generateEmailHash(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
  }

  /**
   * Verify single email address
   */
  public async verifyEmail(email: string, ipAddress?: string): Promise<EmailVerificationResult> {
    try {
      if (!this.isConfigured) {
        throw new Error('ZeroBounce API key not configured');
      }

      // Check cache first
      const emailHash = this.generateEmailHash(email);
      const cachedResult = await cacheService.get('email_verification', emailHash);
      
      if (cachedResult) {
        console.log(`💰 Cache HIT: Email verification for ${email}`);
        return cachedResult;
      }

      console.log(`💸 Cache MISS: Email verification for ${email}`);

      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Make API request
      const params = new URLSearchParams({
        apikey: this.apiKey,
        email: email
      });

      if (ipAddress) {
        params.append('ipaddress', ipAddress);
      }

      const response = await this.client.get(`/validate?${params.toString()}`);
      const apiResult = response.data;

      // Transform API response to our format
      const result: EmailVerificationResult = {
        email: apiResult.address,
        status: this.mapStatus(apiResult.status),
        subStatus: apiResult.sub_status,
        freeEmail: apiResult.free_email,
        disposableEmail: apiResult.disposable,
        roleAccount: apiResult.role_account,
        toxicDomain: apiResult.toxic,
        firstName: apiResult.firstname,
        lastName: apiResult.lastname,
        gender: apiResult.gender,
        location: apiResult.location,
        creationDate: apiResult.creation_date,
        deliverabilityScore: this.calculateDeliverabilityScore(apiResult),
        riskLevel: this.calculateRiskLevel(apiResult),
        suggestion: apiResult.did_you_mean,
        mxRecord: apiResult.mx_record,
        smtp: apiResult.smtp_provider,
        verifiedAt: new Date().toISOString(),
        credits: apiResult.credits_used || 1
      };

      // Cache the result for 24 hours
      await cacheService.set('email_verification', emailHash, result, 86400);

      console.log(`✅ Email verification completed for ${email}: ${result.status} (Score: ${result.deliverabilityScore})`);
      return result;

    } catch (error: any) {
      console.error(`❌ Email verification failed for ${email}:`, error.message);
      
      // Return error result
      return {
        email,
        status: 'error',
        subStatus: 'verification_failed',
        deliverabilityScore: 0,
        riskLevel: 'high',
        error: error.message,
        verifiedAt: new Date().toISOString(),
        credits: 0
      };
    }
  }

  /**
   * Bulk email verification
   */
  public async verifyBulkEmails(
    emails: string[], 
    userId: string,
    batchSize: number = 50
  ): Promise<BulkVerificationResult> {
    try {
      if (!this.isConfigured) {
        throw new Error('ZeroBounce API key not configured');
      }

      console.log(`📧 Starting bulk verification for ${emails.length} emails`);
      
      const results: EmailVerificationResult[] = [];
      const errors: string[] = [];
      let totalCreditsUsed = 0;
      let cacheHits = 0;
      let apiCalls = 0;

      // Process emails in batches
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}`);

        // Process batch with Promise.allSettled to handle individual failures
        const batchPromises = batch.map(async (email) => {
          try {
            return await this.verifyEmail(email);
          } catch (error: any) {
            errors.push(`${email}: ${error.message}`);
            return {
              email,
              status: 'error',
              deliverabilityScore: 0,
              riskLevel: 'high',
              error: error.message,
              verifiedAt: new Date().toISOString(),
              credits: 0
            } as EmailVerificationResult;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            totalCreditsUsed += result.value.credits || 0;
            
            if (result.value.credits === 0) {
              cacheHits++;
            } else {
              apiCalls++;
            }
          }
        }

        // Rate limiting: wait between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Calculate statistics
      const stats = this.calculateBulkStats(results);

      const bulkResult: BulkVerificationResult = {
        totalEmails: emails.length,
        processedEmails: results.length,
        validEmails: stats.valid,
        invalidEmails: stats.invalid,
        risky: stats.risky,
        unknown: stats.unknown,
        disposable: stats.disposable,
        results,
        errors,
        statistics: {
          deliverabilityRate: Math.round((stats.valid / results.length) * 100),
          averageScore: Math.round(stats.totalScore / results.length),
          riskDistribution: stats.riskDistribution,
          statusDistribution: stats.statusDistribution
        },
        performance: {
          cacheHits,
          apiCalls,
          totalCreditsUsed,
          processingTime: Date.now() // Will be updated by caller
        },
        userId,
        verifiedAt: new Date().toISOString()
      };

      // Cache bulk result
      const bulkHash = crypto.createHash('sha256')
        .update(`bulk:${userId}:${emails.join(',')}`)
        .digest('hex')
        .substring(0, 16);
      
      await cacheService.set('bulk_verification', bulkHash, bulkResult, 3600); // 1 hour cache

      console.log(`✅ Bulk verification completed: ${stats.valid}/${emails.length} valid emails`);
      return bulkResult;

    } catch (error: any) {
      console.error('❌ Bulk email verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Get account credits
   */
  public async getAccountCredits(): Promise<CreditsInfo> {
    try {
      if (!this.isConfigured) {
        throw new Error('ZeroBounce API key not configured');
      }

      const response = await this.client.get(`/getcredits?apikey=${this.apiKey}`);
      const data = response.data;

      return {
        credits: data.Credits || 0,
        status: 'success',
        retrievedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ Failed to get account credits:', error.message);
      return {
        credits: 0,
        status: 'error',
        error: error.message,
        retrievedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Map ZeroBounce status to our standard status
   */
  private mapStatus(status: string): string {
    switch (status?.toLowerCase()) {
      case 'valid':
        return 'valid';
      case 'invalid':
        return 'invalid';
      case 'catch-all':
        return 'risky';
      case 'spamtrap':
        return 'invalid';
      case 'abuse':
        return 'invalid';
      case 'do_not_mail':
        return 'invalid';
      case 'unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  /**
   * Calculate deliverability score (0-100)
   */
  private calculateDeliverabilityScore(apiResult: any): number {
    let score = 0;

    // Base score from status
    switch (apiResult.status?.toLowerCase()) {
      case 'valid':
        score = 90;
        break;
      case 'catch-all':
        score = 60;
        break;
      case 'unknown':
        score = 40;
        break;
      case 'invalid':
      case 'spamtrap':
      case 'abuse':
      case 'do_not_mail':
        score = 10;
        break;
      default:
        score = 30;
    }

    // Adjust based on additional factors
    if (apiResult.disposable) score -= 20;
    if (apiResult.toxic) score -= 30;
    if (apiResult.role_account) score -= 10;
    if (apiResult.free_email && score > 70) score -= 5;
    if (apiResult.mx_record) score += 5;
    if (apiResult.smtp_provider) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(apiResult: any): string {
    const score = this.calculateDeliverabilityScore(apiResult);
    
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'very_high';
  }

  /**
   * Calculate bulk verification statistics
   */
  private calculateBulkStats(results: EmailVerificationResult[]): any {
    const stats = {
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      disposable: 0,
      totalScore: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, very_high: 0 },
      statusDistribution: { valid: 0, invalid: 0, risky: 0, unknown: 0, error: 0 }
    };

    for (const result of results) {
      stats.totalScore += result.deliverabilityScore;
      
      // Count by status
      switch (result.status) {
        case 'valid':
          stats.valid++;
          stats.statusDistribution.valid++;
          break;
        case 'invalid':
          stats.invalid++;
          stats.statusDistribution.invalid++;
          break;
        case 'risky':
          stats.risky++;
          stats.statusDistribution.risky++;
          break;
        case 'unknown':
          stats.unknown++;
          stats.statusDistribution.unknown++;
          break;
        case 'error':
          stats.statusDistribution.error++;
          break;
      }

      // Count disposable emails
      if (result.disposableEmail) {
        stats.disposable++;
      }

      // Count by risk level
      if (result.riskLevel) {
        stats.riskDistribution[result.riskLevel as keyof typeof stats.riskDistribution]++;
      }
    }

    return stats;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        return false;
      }

      const credits = await this.getAccountCredits();
      return credits.status === 'success';
    } catch (error) {
      console.error('❌ ZeroBounce health check failed:', error);
      return false;
    }
  }

  /**
   * Get service status
   */
  public getStatus(): ServiceStatus {
    return {
      configured: this.isConfigured,
      healthy: this.isConfigured,
      apiUrl: this.baseURL,
      rateLimitInfo: {
        maxRequestsPerMinute: this.maxRequestsPerMinute,
        windowMs: this.rateLimitWindow
      }
    };
  }
}

// Types
export interface EmailVerificationResult {
  email: string;
  status: string;
  subStatus?: string;
  freeEmail?: boolean;
  disposableEmail?: boolean;
  roleAccount?: boolean;
  toxicDomain?: boolean;
  firstName?: string;
  lastName?: string;
  gender?: string;
  location?: string;
  creationDate?: string;
  deliverabilityScore: number;
  riskLevel: string;
  suggestion?: string;
  mxRecord?: string;
  smtp?: string;
  verifiedAt: string;
  credits: number;
  error?: string;
}

export interface BulkVerificationResult {
  totalEmails: number;
  processedEmails: number;
  validEmails: number;
  invalidEmails: number;
  risky: number;
  unknown: number;
  disposable: number;
  results: EmailVerificationResult[];
  errors: string[];
  statistics: {
    deliverabilityRate: number;
    averageScore: number;
    riskDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
  };
  performance: {
    cacheHits: number;
    apiCalls: number;
    totalCreditsUsed: number;
    processingTime: number;
  };
  userId: string;
  verifiedAt: string;
}

export interface CreditsInfo {
  credits: number;
  status: string;
  error?: string;
  retrievedAt: string;
}

export interface ServiceStatus {
  configured: boolean;
  healthy: boolean;
  apiUrl: string;
  rateLimitInfo: {
    maxRequestsPerMinute: number;
    windowMs: number;
  };
}

// Export singleton instance
export const zeroBounceClient = ZeroBounceClient.getInstance();