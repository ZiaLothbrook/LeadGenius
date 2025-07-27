/**
 * Email Delivery Engine API Routes (CARD-010)
 * Comprehensive email delivery management endpoints
 */

import { Express, Request, Response } from 'express';
import { emailDeliveryEngine, EmailDeliveryRequest, DeliveryResult } from '../services/emailDeliveryEngine';

// Authentication middleware (inline definition)
const isAuthenticatedLocal = async (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    if (req.user.id || (req.user.claims && req.user.claims.sub)) {
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
};

export function registerEmailDeliveryRoutes(app: Express): void {
  console.log('📬 Setting up Email Delivery Engine routes...');

  /**
   * @swagger
   * /api/email-delivery/send:
   *   post:
   *     summary: Send single email via delivery engine
   *     tags: [Email Delivery]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               to:
   *                 type: string
   *                 format: email
   *               subject:
   *                 type: string
   *               htmlContent:
   *                 type: string
   *               priority:
   *                 type: string
   *                 enum: [high, normal, low]
   *               campaignId:
   *                 type: string
   *               prospectId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Email queued successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/email-delivery/send', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const {
        to,
        subject,
        htmlContent,
        textContent,
        priority = 'normal',
        campaignId,
        prospectId,
        templateId,
        templateData,
        scheduledAt,
        variant,
        tag
      } = req.body;

      if (!to || !subject || !htmlContent) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, htmlContent'
        });
      }

      const deliveryRequest: EmailDeliveryRequest = {
        userId,
        to,
        subject,
        htmlContent,
        textContent,
        priority,
        campaignId,
        prospectId,
        templateId,
        templateData,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        variant,
        tag,
        trackOpens: true,
        trackLinks: true
      };

      const result = await emailDeliveryEngine.queueEmail(deliveryRequest);

      res.json({
        success: true,
        emailId: result.id,
        status: result.status,
        message: 'Email queued for delivery'
      });

    } catch (error) {
      console.error('❌ Email delivery API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue email for delivery',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/campaign:
   *   post:
   *     summary: Send campaign email
   *     tags: [Email Delivery]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               campaignId:
   *                 type: string
   *               prospectId:
   *                 type: string
   *               messageId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Campaign email sent successfully
   */
  app.post('/api/email-delivery/campaign', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const { campaignId, prospectId, messageId } = req.body;

      if (!campaignId || !prospectId || !messageId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: campaignId, prospectId, messageId'
        });
      }

      const result = await emailDeliveryEngine.sendCampaignEmail(campaignId, prospectId, messageId);

      res.json({
        success: true,
        deliveryResult: result,
        message: 'Campaign email processed'
      });

    } catch (error) {
      console.error('❌ Campaign email delivery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send campaign email',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/analytics:
   *   get:
   *     summary: Get delivery analytics
   *     tags: [Email Delivery]
   *     parameters:
   *       - in: query
   *         name: campaignId
   *         schema:
   *           type: string
   *       - in: query
   *         name: timeframe
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Delivery analytics
   */
  app.get('/api/email-delivery/analytics', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { campaignId, timeframe = 'week' } = req.query;

      const analytics = await emailDeliveryEngine.getDeliveryAnalytics(
        userId,
        campaignId as string,
        timeframe as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        analytics,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Analytics retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/reputation:
   *   get:
   *     summary: Get user reputation metrics
   *     tags: [Email Delivery]
   *     responses:
   *       200:
   *         description: User reputation metrics
   */
  app.get('/api/email-delivery/reputation', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      const reputation = await emailDeliveryEngine.checkUserReputation(userId);

      res.json({
        success: true,
        reputation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Reputation check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check reputation',
        message: (error as Error).message
      });
    }
  });

  /**
   * WEBHOOK ENDPOINTS FOR POSTMARK INTEGRATION
   */

  /**
   * @swagger
   * /api/email-delivery/webhook/bounce:
   *   post:
   *     summary: Handle bounce notifications from Postmark
   *     tags: [Email Delivery Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Bounce processed successfully
   */
  app.post('/api/email-delivery/webhook/bounce', async (req: Request, res: Response) => {
    try {
      const bounceData = req.body;

      // Validate Postmark webhook (in production, verify webhook signature)
      if (!bounceData.MessageID || !bounceData.Email) {
        return res.status(400).json({ error: 'Invalid bounce data' });
      }

      await emailDeliveryEngine.handleBounce({
        messageId: bounceData.MessageID,
        email: bounceData.Email,
        bounceType: bounceData.Type === 'HardBounce' ? 'hard' : 'soft',
        reason: bounceData.Description || bounceData.Details,
        timestamp: bounceData.BouncedAt
      });

      res.json({ success: true, message: 'Bounce processed' });

    } catch (error) {
      console.error('❌ Bounce webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bounce',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/webhook/unsubscribe:
   *   post:
   *     summary: Handle unsubscribe notifications from Postmark
   *     tags: [Email Delivery Webhooks]
   *     responses:
   *       200:
   *         description: Unsubscribe processed successfully
   */
  app.post('/api/email-delivery/webhook/unsubscribe', async (req: Request, res: Response) => {
    try {
      const unsubData = req.body;

      if (!unsubData.MessageID || !unsubData.Recipient) {
        return res.status(400).json({ error: 'Invalid unsubscribe data' });
      }

      await emailDeliveryEngine.handleUnsubscribe({
        messageId: unsubData.MessageID,
        email: unsubData.Recipient,
        timestamp: unsubData.SuppressedAt || new Date().toISOString(),
        reason: unsubData.Origin || 'unsubscribe_request'
      });

      res.json({ success: true, message: 'Unsubscribe processed' });

    } catch (error) {
      console.error('❌ Unsubscribe webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process unsubscribe',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/webhook/open:
   *   post:
   *     summary: Handle email open tracking from Postmark
   *     tags: [Email Delivery Webhooks]
   *     responses:
   *       200:
   *         description: Open event processed successfully
   */
  app.post('/api/email-delivery/webhook/open', async (req: Request, res: Response) => {
    try {
      const openData = req.body;

      // Process email open event
      console.log('📧 Email opened:', {
        messageId: openData.MessageID,
        recipient: openData.Recipient,
        firstOpen: openData.FirstOpen,
        timestamp: openData.ReceivedAt
      });

      // This would update campaign analytics in production
      res.json({ success: true, message: 'Open event processed' });

    } catch (error) {
      console.error('❌ Open webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process open event',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/webhook/click:
   *   post:
   *     summary: Handle email click tracking from Postmark
   *     tags: [Email Delivery Webhooks]
   *     responses:
   *       200:
   *         description: Click event processed successfully
   */
  app.post('/api/email-delivery/webhook/click', async (req: Request, res: Response) => {
    try {
      const clickData = req.body;

      // Process email click event
      console.log('🖱️ Email link clicked:', {
        messageId: clickData.MessageID,
        recipient: clickData.Recipient,
        originalLink: clickData.OriginalLink,
        timestamp: clickData.ReceivedAt
      });

      // This would update campaign analytics in production
      res.json({ success: true, message: 'Click event processed' });

    } catch (error) {
      console.error('❌ Click webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process click event',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/queue/status:
   *   get:
   *     summary: Get email delivery queue status
   *     tags: [Email Delivery]
   *     responses:
   *       200:
   *         description: Queue status information
   */
  app.get('/api/email-delivery/queue/status', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      // This would return real queue status in production
      const queueStatus = {
        queuedEmails: 0,
        processingEmails: 0,
        sentToday: 156,
        deliveryRate: 98.2,
        averageDeliveryTime: 1.2, // seconds
        throttleStatus: {
          hourlyLimit: 100,
          hourlyUsed: 23,
          dailyLimit: 1000,
          dailyUsed: 156
        }
      };

      res.json({
        success: true,
        status: queueStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Queue status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/email-delivery/suppression:
   *   get:
   *     summary: Get suppression list for user
   *     tags: [Email Delivery]
   *     responses:
   *       200:
   *         description: User suppression list
   */
  app.get('/api/email-delivery/suppression', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;

      // This would return real suppression data in production
      const suppressionList = {
        totalSuppressed: 15,
        reasons: {
          hard_bounce: 8,
          soft_bounce: 2,
          unsubscribe: 4,
          complaint: 1
        },
        recentSuppressions: [
          {
            email: 'bounced@example.com',
            reason: 'hard_bounce',
            suppressedAt: '2025-01-27T10:30:00Z'
          }
        ]
      };

      res.json({
        success: true,
        suppression: suppressionList,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Suppression list error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get suppression list',
        message: (error as Error).message
      });
    }
  });

  console.log('✅ Email Delivery Engine routes configured');
}