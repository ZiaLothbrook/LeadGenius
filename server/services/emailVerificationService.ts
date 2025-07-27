import { zeroBounceClient, EmailVerificationResult, BulkVerificationResult } from './zeroBounceClient';
import { cacheService } from './cacheService';
import { storage } from '../storage';
import * as crypto from 'crypto';

/**
 * Email Verification Service
 * High-level service for managing email verification with database persistence and analytics
 */
export class EmailVerificationService {
  private static instance: EmailVerificationService;

  private constructor() {}

  public static getInstance(): EmailVerificationService {
    if (!EmailVerificationService.instance) {
      EmailVerificationService.instance = new EmailVerificationService();
    }
    return EmailVerificationService.instance;
  }

  /**
   * Verify single email with caching and database persistence
   */
  public async verifySingleEmail(
    email: string, 
    userId: string, 
    ipAddress?: string
  ): Promise<EmailVerificationServiceResult> {
    try {
      console.log(`📧 Starting email verification for: ${email}`);
      
      // Check database first for recent verification
      const recentVerification = await this.getRecentVerification(email, userId);
      if (recentVerification) {
        console.log(`💾 Using recent database verification for ${email}`);
        return {
          success: true,
          result: this.transformDbToResult(recentVerification),
          source: 'database',
          cached: false
        };
      }

      // Verify through ZeroBounce
      const startTime = Date.now();
      const verificationResult = await zeroBounceClient.verifyEmail(email, ipAddress);
      const processingTime = Date.now() - startTime;

      // Save to database
      await this.saveVerificationToDatabase(verificationResult, userId);

      // Update prospect email status if prospect exists
      await this.updateProspectEmailStatus(email, verificationResult, userId);

      console.log(`✅ Email verification completed for ${email}: ${verificationResult.status} (${processingTime}ms)`);

      return {
        success: true,
        result: verificationResult,
        source: verificationResult.credits === 0 ? 'cache' : 'api',
        cached: verificationResult.credits === 0,
        processingTime
      };

    } catch (error: any) {
      console.error(`❌ Email verification service error for ${email}:`, error.message);
      return {
        success: false,
        error: error.message,
        result: {
          email,
          status: 'error',
          deliverabilityScore: 0,
          riskLevel: 'high',
          verifiedAt: new Date().toISOString(),
          credits: 0
        }
      };
    }
  }

  /**
   * Bulk email verification with progress tracking
   */
  public async verifyBulkEmails(
    emails: string[], 
    userId: string, 
    batchName?: string,
    onProgress?: (progress: BulkProgress) => void
  ): Promise<BulkEmailVerificationServiceResult> {
    try {
      console.log(`📧 Starting bulk verification for ${emails.length} emails`);
      
      const startTime = Date.now();
      
      // Create bulk verification record
      const bulkRecord = await this.createBulkVerificationRecord(emails.length, userId, batchName);
      
      // Filter out recently verified emails
      const emailsToVerify = await this.filterRecentlyVerified(emails, userId);
      console.log(`📧 ${emailsToVerify.length}/${emails.length} emails need verification`);

      // Progress callback setup
      let processedCount = 0;
      const reportProgress = (increment: number = 1) => {
        processedCount += increment;
        if (onProgress) {
          onProgress({
            total: emails.length,
            processed: processedCount,
            percentage: Math.round((processedCount / emails.length) * 100),
            bulkId: bulkRecord.id
          });
        }
      };

      // Perform bulk verification
      const bulkResult = await zeroBounceClient.verifyBulkEmails(
        emailsToVerify, 
        userId, 
        25 // Smaller batch size for better progress tracking
      );

      // Get cached results for skipped emails
      const cachedResults = await this.getCachedResults(
        emails.filter(email => !emailsToVerify.includes(email)), 
        userId
      );

      // Combine results
      const allResults = [...bulkResult.results, ...cachedResults];
      const finalBulkResult = {
        ...bulkResult,
        totalEmails: emails.length,
        results: allResults,
        performance: {
          ...bulkResult.performance,
          processingTime: Date.now() - startTime,
          cacheHits: bulkResult.performance.cacheHits + cachedResults.length
        }
      };

      // Save individual verifications to database
      await this.saveBulkVerificationsToDatabase(finalBulkResult.results, userId);

      // Update bulk record
      await this.updateBulkVerificationRecord(bulkRecord.id, finalBulkResult);

      // Update prospect email statuses
      await this.updateProspectsEmailStatuses(finalBulkResult.results, userId);

      console.log(`✅ Bulk verification completed: ${finalBulkResult.validEmails}/${emails.length} valid emails`);

      return {
        success: true,
        bulkId: bulkRecord.id,
        result: finalBulkResult,
        summary: this.generateBulkSummary(finalBulkResult)
      };

    } catch (error: any) {
      console.error('❌ Bulk email verification service error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get verification history for user
   */
  public async getVerificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      return await storage.getEmailVerificationHistory(userId, limit);
    } catch (error: any) {
      console.error('❌ Failed to get verification history:', error.message);
      return [];
    }
  }

  /**
   * Get bulk verification history
   */
  public async getBulkVerificationHistory(userId: string, limit: number = 20): Promise<any[]> {
    try {
      return await storage.getBulkEmailVerificationHistory(userId, limit);
    } catch (error: any) {
      console.error('❌ Failed to get bulk verification history:', error.message);
      return [];
    }
  }

  /**
   * Get verification statistics for user
   */
  public async getVerificationStats(userId: string): Promise<VerificationStats> {
    try {
      const stats = await storage.getEmailVerificationStats(userId);
      
      return {
        totalVerifications: stats.totalVerifications || 0,
        validEmails: stats.validEmails || 0,
        invalidEmails: stats.invalidEmails || 0,
        riskyEmails: stats.riskyEmails || 0,
        unknownEmails: stats.unknownEmails || 0,
        averageDeliverabilityScore: stats.averageScore || 0,
        totalCreditsUsed: stats.totalCreditsUsed || 0,
        verificationRate: stats.totalVerifications > 0 
          ? Math.round((stats.validEmails / stats.totalVerifications) * 100) 
          : 0,
        lastVerification: stats.lastVerification,
        topRiskFactors: stats.topRiskFactors || []
      };
    } catch (error: any) {
      console.error('❌ Failed to get verification stats:', error.message);
      return {
        totalVerifications: 0,
        validEmails: 0,
        invalidEmails: 0,
        riskyEmails: 0,
        unknownEmails: 0,
        averageDeliverabilityScore: 0,
        totalCreditsUsed: 0,
        verificationRate: 0,
        topRiskFactors: []
      };
    }
  }

  /**
   * Check recent verification in database
   */
  private async getRecentVerification(email: string, userId: string): Promise<any | null> {
    try {
      // Check for verification within last 24 hours
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return await storage.getRecentEmailVerification(email, userId, recentCutoff);
    } catch (error) {
      console.error('❌ Failed to check recent verification:', error);
      return null;
    }
  }

  /**
   * Save verification to database
   */
  private async saveVerificationToDatabase(result: EmailVerificationResult, userId: string): Promise<void> {
    try {
      if (result.status === 'error') return;

      await storage.createEmailVerification({
        email: result.email,
        status: result.status,
        subStatus: result.subStatus,
        deliverabilityScore: result.deliverabilityScore,
        riskLevel: result.riskLevel,
        freeEmail: result.freeEmail,
        disposableEmail: result.disposableEmail,
        roleAccount: result.roleAccount,
        toxicDomain: result.toxicDomain,
        firstName: result.firstName,
        lastName: result.lastName,
        gender: result.gender,
        location: result.location,
        suggestion: result.suggestion,
        mxRecord: result.mxRecord,
        smtpProvider: result.smtp,
        creditsUsed: result.credits,
        userId
      });
    } catch (error: any) {
      console.error('❌ Failed to save verification to database:', error.message);
    }
  }

  /**
   * Save bulk verifications to database
   */
  private async saveBulkVerificationsToDatabase(results: EmailVerificationResult[], userId: string): Promise<void> {
    try {
      const validResults = results.filter(r => r.status !== 'error');
      if (validResults.length === 0) return;

      await storage.createBulkEmailVerifications(
        validResults.map(result => ({
          email: result.email,
          status: result.status,
          subStatus: result.subStatus,
          deliverabilityScore: result.deliverabilityScore,
          riskLevel: result.riskLevel,
          freeEmail: result.freeEmail,
          disposableEmail: result.disposableEmail,
          roleAccount: result.roleAccount,
          toxicDomain: result.toxicDomain,
          firstName: result.firstName,
          lastName: result.lastName,
          gender: result.gender,
          location: result.location,
          suggestion: result.suggestion,
          mxRecord: result.mxRecord,
          smtpProvider: result.smtp,
          creditsUsed: result.credits,
          userId
        }))
      );
    } catch (error: any) {
      console.error('❌ Failed to save bulk verifications to database:', error.message);
    }
  }

  /**
   * Create bulk verification record
   */
  private async createBulkVerificationRecord(totalEmails: number, userId: string, batchName?: string): Promise<any> {
    try {
      return await storage.createBulkEmailVerification({
        batchName: batchName || `Bulk verification ${new Date().toISOString()}`,
        totalEmails,
        processedEmails: 0,
        status: 'processing',
        userId
      });
    } catch (error: any) {
      console.error('❌ Failed to create bulk verification record:', error.message);
      throw error;
    }
  }

  /**
   * Update bulk verification record
   */
  private async updateBulkVerificationRecord(bulkId: string, result: BulkVerificationResult): Promise<void> {
    try {
      await storage.updateBulkEmailVerification(bulkId, {
        processedEmails: result.processedEmails,
        validEmails: result.validEmails,
        invalidEmails: result.invalidEmails,
        riskyEmails: result.risky,
        unknownEmails: result.unknown,
        disposableEmails: result.disposable,
        deliverabilityRate: result.statistics.deliverabilityRate,
        averageScore: result.statistics.averageScore,
        totalCreditsUsed: result.performance.totalCreditsUsed,
        cacheHits: result.performance.cacheHits,
        apiCalls: result.performance.apiCalls,
        processingTimeMs: result.performance.processingTime,
        status: 'completed'
      });
    } catch (error: any) {
      console.error('❌ Failed to update bulk verification record:', error.message);
    }
  }

  /**
   * Filter recently verified emails
   */
  private async filterRecentlyVerified(emails: string[], userId: string): Promise<string[]> {
    try {
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentlyVerified = await storage.getRecentlyVerifiedEmails(emails, userId, recentCutoff);
      const recentEmails = new Set(recentlyVerified.map((v: any) => v.email));
      
      return emails.filter(email => !recentEmails.has(email));
    } catch (error) {
      console.error('❌ Failed to filter recently verified emails:', error);
      return emails;
    }
  }

  /**
   * Get cached results for previously verified emails
   */
  private async getCachedResults(emails: string[], userId: string): Promise<EmailVerificationResult[]> {
    try {
      if (emails.length === 0) return [];
      
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cachedVerifications = await storage.getRecentlyVerifiedEmails(emails, userId, recentCutoff);
      
      return cachedVerifications.map((v: any) => this.transformDbToResult(v));
    } catch (error) {
      console.error('❌ Failed to get cached results:', error);
      return [];
    }
  }

  /**
   * Transform database record to verification result
   */
  private transformDbToResult(dbRecord: any): EmailVerificationResult {
    return {
      email: dbRecord.email,
      status: dbRecord.status,
      subStatus: dbRecord.subStatus,
      deliverabilityScore: dbRecord.deliverabilityScore,
      riskLevel: dbRecord.riskLevel,
      freeEmail: dbRecord.freeEmail,
      disposableEmail: dbRecord.disposableEmail,
      roleAccount: dbRecord.roleAccount,
      toxicDomain: dbRecord.toxicDomain,
      firstName: dbRecord.firstName,
      lastName: dbRecord.lastName,
      gender: dbRecord.gender,
      location: dbRecord.location,
      suggestion: dbRecord.suggestion,
      mxRecord: dbRecord.mxRecord,
      smtp: dbRecord.smtpProvider,
      verifiedAt: dbRecord.verifiedAt || dbRecord.createdAt,
      credits: 0 // Database record means no credits used
    };
  }

  /**
   * Update prospect email status
   */
  private async updateProspectEmailStatus(
    email: string, 
    verification: EmailVerificationResult, 
    userId: string
  ): Promise<void> {
    try {
      await storage.updateProspectEmailStatus(email, verification.status, userId);
    } catch (error) {
      console.error('❌ Failed to update prospect email status:', error);
    }
  }

  /**
   * Update multiple prospects email statuses
   */
  private async updateProspectsEmailStatuses(
    verifications: EmailVerificationResult[], 
    userId: string
  ): Promise<void> {
    try {
      const updates = verifications.map(v => ({
        email: v.email,
        status: v.status
      }));
      
      await storage.updateProspectsEmailStatuses(updates, userId);
    } catch (error) {
      console.error('❌ Failed to update prospects email statuses:', error);
    }
  }

  /**
   * Generate bulk verification summary
   */
  private generateBulkSummary(result: BulkVerificationResult): BulkSummary {
    return {
      totalProcessed: result.processedEmails,
      validEmails: result.validEmails,
      invalidEmails: result.invalidEmails,
      riskyEmails: result.risky,
      unknownEmails: result.unknown,
      disposableEmails: result.disposable,
      deliverabilityRate: result.statistics.deliverabilityRate,
      averageScore: result.statistics.averageScore,
      creditsUsed: result.performance.totalCreditsUsed,
      processingTime: result.performance.processingTime,
      recommendations: this.generateRecommendations(result)
    };
  }

  /**
   * Generate recommendations based on verification results
   */
  private generateRecommendations(result: BulkVerificationResult): string[] {
    const recommendations: string[] = [];
    
    if (result.statistics.deliverabilityRate < 70) {
      recommendations.push('Consider cleaning your email list to improve deliverability');
    }
    
    if (result.disposable > result.totalEmails * 0.1) {
      recommendations.push('High number of disposable emails detected - implement better signup validation');
    }
    
    if (result.risky > result.totalEmails * 0.2) {
      recommendations.push('Many risky emails found - consider additional verification steps');
    }
    
    if (result.statistics.averageScore < 60) {
      recommendations.push('Low average deliverability score - focus on list quality over quantity');
    }
    
    return recommendations;
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<ServiceHealthStatus> {
    try {
      const [zeroBounceHealth, credits] = await Promise.all([
        zeroBounceClient.healthCheck(),
        zeroBounceClient.getAccountCredits()
      ]);

      return {
        healthy: zeroBounceHealth,
        configured: zeroBounceClient.getStatus().configured,
        credits: credits.credits,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        healthy: false,
        configured: false,
        credits: 0,
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

// Types
export interface EmailVerificationServiceResult {
  success: boolean;
  result: EmailVerificationResult;
  source?: string;
  cached?: boolean;
  processingTime?: number;
  error?: string;
}

export interface BulkEmailVerificationServiceResult {
  success: boolean;
  bulkId?: string;
  result?: BulkVerificationResult;
  summary?: BulkSummary;
  error?: string;
}

export interface BulkProgress {
  total: number;
  processed: number;
  percentage: number;
  bulkId: string;
}

export interface BulkSummary {
  totalProcessed: number;
  validEmails: number;
  invalidEmails: number;
  riskyEmails: number;
  unknownEmails: number;
  disposableEmails: number;
  deliverabilityRate: number;
  averageScore: number;
  creditsUsed: number;
  processingTime: number;
  recommendations: string[];
}

export interface VerificationStats {
  totalVerifications: number;
  validEmails: number;
  invalidEmails: number;
  riskyEmails: number;
  unknownEmails: number;
  averageDeliverabilityScore: number;
  totalCreditsUsed: number;
  verificationRate: number;
  lastVerification?: string;
  topRiskFactors: string[];
}

export interface ServiceHealthStatus {
  healthy: boolean;
  configured: boolean;
  credits: number;
  lastCheck: string;
  error?: string;
}

// Export singleton instance
export const emailVerificationService = EmailVerificationService.getInstance();