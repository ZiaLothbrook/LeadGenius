import type { Express } from "express";
import { z } from "zod";
import { emailVerificationService } from "../services/emailVerificationService";
import { zeroBounceClient } from "../services/zeroBounceClient";
import { cacheResponse } from "../middleware/cacheMiddleware";
import { isAuthenticatedLocal } from "../localAuth";

/**
 * Email Verification Routes for CARD-013
 * Comprehensive email verification with ZeroBounce integration
 */
export function setupEmailVerificationRoutes(app: Express): void {
  console.log('🔧 Setting up email verification routes...');

  // Validation schemas
  const singleEmailSchema = z.object({
    email: z.string().email('Invalid email format'),
    ipAddress: z.string().optional()
  });

  const bulkEmailSchema = z.object({
    emails: z.array(z.string().email()).min(1, 'At least one email required').max(1000, 'Maximum 1000 emails per batch'),
    batchName: z.string().optional()
  });

  // Single email verification
  app.post('/api/email-verification/verify', isAuthenticatedLocal, async (req: any, res) => {
    try {
      console.log(`📧 Email verification request from user: ${req.user?.id || 'anonymous'}`);
      
      const validation = singleEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        });
      }

      const { email, ipAddress } = validation.data;
      const userId = req.user?.id || 'anonymous';

      const result = await emailVerificationService.verifySingleEmail(email, userId, ipAddress);

      return res.json(result);

    } catch (error: any) {
      console.error('❌ Email verification error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Email verification failed',
        message: error.message
      });
    }
  });

  // Bulk email verification
  app.post('/api/email-verification/bulk', isAuthenticatedLocal, async (req: any, res) => {
    try {
      console.log(`📧 Bulk email verification request from user: ${req.user?.id || 'anonymous'}`);
      
      const validation = bulkEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        });
      }

      const { emails, batchName } = validation.data;
      const userId = req.user?.id || 'anonymous';

      console.log(`📧 Processing bulk verification for ${emails.length} emails`);

      // Start verification with progress tracking
      const result = await emailVerificationService.verifyBulkEmails(
        emails, 
        userId, 
        batchName,
        (progress) => {
          // Could implement WebSocket progress updates here
          console.log(`📊 Bulk verification progress: ${progress.percentage}% (${progress.processed}/${progress.total})`);
        }
      );

      return res.json(result);

    } catch (error: any) {
      console.error('❌ Bulk email verification error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Bulk email verification failed',
        message: error.message
      });
    }
  });

  // Get verification history
  app.get('/api/email-verification/history', isAuthenticatedLocal, cacheResponse('verification_history', 300), async (req: any, res) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const limit = parseInt(req.query.limit as string) || 50;

      const history = await emailVerificationService.getVerificationHistory(userId, limit);

      return res.json({
        success: true,
        history,
        total: history.length
      });

    } catch (error: any) {
      console.error('❌ Get verification history error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to get verification history',
        message: error.message
      });
    }
  });

  // Get bulk verification history
  app.get('/api/email-verification/bulk-history', isAuthenticatedLocal, cacheResponse('bulk_verification_history', 300), async (req: any, res) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await emailVerificationService.getBulkVerificationHistory(userId, limit);

      return res.json({
        success: true,
        history,
        total: history.length
      });

    } catch (error: any) {
      console.error('❌ Get bulk verification history error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to get bulk verification history',
        message: error.message
      });
    }
  });

  // Get verification statistics
  app.get('/api/email-verification/stats', isAuthenticatedLocal, cacheResponse('verification_stats', 600), async (req: any, res) => {
    try {
      const userId = req.user?.id || 'anonymous';

      const stats = await emailVerificationService.getVerificationStats(userId);

      return res.json({
        success: true,
        stats
      });

    } catch (error: any) {
      console.error('❌ Get verification stats error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to get verification statistics',
        message: error.message
      });
    }
  });

  // Get account credits
  app.get('/api/email-verification/credits', cacheResponse('zerobounce_credits', 300), async (req, res) => {
    try {
      const credits = await zeroBounceClient.getAccountCredits();

      return res.json({
        success: true,
        credits: credits.credits,
        status: credits.status,
        retrievedAt: credits.retrievedAt,
        error: credits.error
      });

    } catch (error: any) {
      console.error('❌ Get credits error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to get account credits',
        message: error.message
      });
    }
  });

  // Service health check
  app.get('/api/email-verification/health', async (req, res) => {
    try {
      const health = await emailVerificationService.getHealthStatus();

      return res.json({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Health check error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  });

  // Service status and configuration
  app.get('/api/email-verification/status', async (req, res) => {
    try {
      const status = zeroBounceClient.getStatus();
      const health = await zeroBounceClient.healthCheck();
      const credits = await zeroBounceClient.getAccountCredits();

      return res.json({
        success: true,
        status: {
          ...status,
          healthy: health,
          credits: credits.credits,
          lastChecked: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Status check error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Status check failed',
        message: error.message
      });
    }
  });

  // Validate email format (lightweight endpoint)
  app.post('/api/email-verification/validate-format', async (req, res) => {
    try {
      const { emails } = req.body;
      
      if (!Array.isArray(emails)) {
        return res.status(400).json({
          success: false,
          error: 'emails must be an array'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const results = emails.map(email => ({
        email,
        valid: emailRegex.test(email),
        error: !emailRegex.test(email) ? 'Invalid email format' : null
      }));

      const validCount = results.filter(r => r.valid).length;

      return res.json({
        success: true,
        total: emails.length,
        valid: validCount,
        invalid: emails.length - validCount,
        results
      });

    } catch (error: any) {
      console.error('❌ Email format validation error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Email format validation failed',
        message: error.message
      });
    }
  });

  console.log('✅ Email verification routes configured');
}