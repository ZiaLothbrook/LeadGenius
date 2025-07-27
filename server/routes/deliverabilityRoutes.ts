import { Router } from 'express';
import { deliverabilityMonitoringService } from '../services/deliverabilityMonitoringService';
import { z } from 'zod';
import { isAuthenticatedLocal } from '../localAuth';

const router = Router();

// Validation schemas
const generateReportSchema = z.object({
  reportPeriod: z.enum(['daily', 'weekly', 'monthly']).optional()
});

const blacklistCheckSchema = z.object({
  targetValue: z.string().min(1),
  monitoringType: z.enum(['domain', 'ip', 'subdomain'])
});

const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1)
});

const updateOptimizationSchema = z.object({
  optimizationId: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'implemented', 'testing', 'completed', 'cancelled']),
  progress: z.number().min(0).max(100).optional()
});

/**
 * Generate comprehensive deliverability report
 */
router.post('/reports/generate', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reportPeriod = 'daily' } = generateReportSchema.parse(req.body);

    const report = await deliverabilityMonitoringService.generateDeliverabilityReport(
      userId,
      reportPeriod
    );

    res.json({
      success: true,
      data: report,
      message: `${reportPeriod} deliverability report generated successfully`
    });

  } catch (error: any) {
    console.error('Error generating deliverability report:', error);
    res.status(500).json({
      error: 'Failed to generate deliverability report',
      message: error.message
    });
  }
});

/**
 * Get deliverability reports for user
 */
router.get('/reports', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const reports = await deliverabilityMonitoringService.getDeliverabilityReports(userId, limit);

    res.json({
      success: true,
      data: reports,
      total: reports.length
    });

  } catch (error: any) {
    console.error('Error fetching deliverability reports:', error);
    res.status(500).json({
      error: 'Failed to fetch deliverability reports',
      message: error.message
    });
  }
});

/**
 * Perform blacklist monitoring check
 */
router.post('/blacklist/check', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { targetValue, monitoringType } = blacklistCheckSchema.parse(req.body);

    const results = await deliverabilityMonitoringService.performBlacklistCheck(
      userId,
      targetValue,
      monitoringType
    );

    const listingsFound = results.filter(r => r.isListed).length;

    res.json({
      success: true,
      data: results,
      summary: {
        totalChecked: results.length,
        listingsFound,
        cleanStatus: listingsFound === 0
      },
      message: listingsFound === 0 ? 
        'All blacklists clear' : 
        `Found ${listingsFound} blacklist listings - immediate action required`
    });

  } catch (error: any) {
    console.error('Error performing blacklist check:', error);
    res.status(500).json({
      error: 'Failed to perform blacklist check',
      message: error.message
    });
  }
});

/**
 * Get blacklist monitoring status
 */
router.get('/blacklist', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const monitoring = await deliverabilityMonitoringService.getBlacklistMonitoring(userId);

    const summary = {
      totalMonitored: monitoring.length,
      activeListings: monitoring.filter(m => m.isListed).length,
      cleanTargets: monitoring.filter(m => !m.isListed).length,
      criticalIssues: monitoring.filter(m => m.isListed && m.severityLevel === 'critical').length
    };

    res.json({
      success: true,
      data: monitoring,
      summary
    });

  } catch (error: any) {
    console.error('Error fetching blacklist monitoring:', error);
    res.status(500).json({
      error: 'Failed to fetch blacklist monitoring',
      message: error.message
    });
  }
});

/**
 * Generate AI optimization recommendations
 */
router.post('/optimize', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const recommendations = await deliverabilityMonitoringService.generateOptimizationRecommendations(userId);

    res.json({
      success: true,
      data: recommendations,
      total: recommendations.length,
      message: `Generated ${recommendations.length} optimization recommendations`
    });

  } catch (error: any) {
    console.error('Error generating optimization recommendations:', error);
    res.status(500).json({
      error: 'Failed to generate optimization recommendations',
      message: error.message
    });
  }
});

/**
 * Get optimization recommendations
 */
router.get('/optimizations', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const optimizations = await deliverabilityMonitoringService.getOptimizationRecommendations(userId);

    const summary = {
      total: optimizations.length,
      pending: optimizations.filter(o => o.status === 'pending').length,
      inProgress: optimizations.filter(o => o.status === 'in_progress').length,
      completed: optimizations.filter(o => o.status === 'completed').length,
      critical: optimizations.filter(o => o.priority === 'critical').length
    };

    res.json({
      success: true,
      data: optimizations,
      summary
    });

  } catch (error: any) {
    console.error('Error fetching optimizations:', error);
    res.status(500).json({
      error: 'Failed to fetch optimizations',
      message: error.message
    });
  }
});

/**
 * Update optimization status
 */
router.put('/optimizations/status', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { optimizationId, status, progress } = updateOptimizationSchema.parse(req.body);

    await deliverabilityMonitoringService.updateOptimizationStatus(
      userId,
      optimizationId,
      status,
      progress
    );

    res.json({
      success: true,
      message: `Optimization status updated to ${status}`
    });

  } catch (error: any) {
    console.error('Error updating optimization status:', error);
    res.status(500).json({
      error: 'Failed to update optimization status',
      message: error.message
    });
  }
});

/**
 * Get active deliverability alerts
 */
router.get('/alerts', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const alerts = await deliverabilityMonitoringService.getActiveAlerts(userId);

    const summary = {
      total: alerts.length,
      emergency: alerts.filter(a => a.alertSeverity === 'emergency').length,
      critical: alerts.filter(a => a.alertSeverity === 'critical').length,
      warning: alerts.filter(a => a.alertSeverity === 'warning').length,
      info: alerts.filter(a => a.alertSeverity === 'info').length
    };

    res.json({
      success: true,
      data: alerts,
      summary
    });

  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

/**
 * Acknowledge alert
 */
router.post('/alerts/acknowledge', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertId } = acknowledgeAlertSchema.parse(req.body);

    await deliverabilityMonitoringService.acknowledgeAlert(userId, alertId);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error.message
    });
  }
});

/**
 * Resolve alert
 */
router.post('/alerts/resolve', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertId } = acknowledgeAlertSchema.parse(req.body);

    await deliverabilityMonitoringService.resolveAlert(userId, alertId);

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

  } catch (error: any) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

/**
 * Get deliverability dashboard overview
 */
router.get('/dashboard', isAuthenticatedLocal, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all dashboard data in parallel
    const [reports, alerts, blacklistStatus, optimizations] = await Promise.all([
      deliverabilityMonitoringService.getDeliverabilityReports(userId, 5),
      deliverabilityMonitoringService.getActiveAlerts(userId),
      deliverabilityMonitoringService.getBlacklistMonitoring(userId),
      deliverabilityMonitoringService.getOptimizationRecommendations(userId)
    ]);

    const latestReport = reports[0];
    
    const dashboard = {
      overview: {
        reputationScore: latestReport?.reputationScore || 0,
        reputationStatus: latestReport?.reputationStatus || 'unknown',
        deliveryRate: latestReport?.deliveryRate || 0,
        bounceRate: latestReport?.bounceRate || 0,
        spamRate: latestReport?.spamRate || 0,
        openRate: latestReport?.openRate || 0,
        lastUpdated: latestReport?.createdAt || null
      },
      alerts: {
        total: alerts.length,
        emergency: alerts.filter(a => a.alertSeverity === 'emergency').length,
        critical: alerts.filter(a => a.alertSeverity === 'critical').length,
        warning: alerts.filter(a => a.alertSeverity === 'warning').length,
        recent: alerts.slice(0, 3)
      },
      blacklist: {
        totalMonitored: blacklistStatus.length,
        activeListings: blacklistStatus.filter(b => b.isListed).length,
        cleanTargets: blacklistStatus.filter(b => !b.isListed).length,
        criticalIssues: blacklistStatus.filter(b => b.isListed && b.severityLevel === 'critical').length
      },
      optimizations: {
        total: optimizations.length,
        pending: optimizations.filter(o => o.status === 'pending').length,
        inProgress: optimizations.filter(o => o.status === 'in_progress').length,
        completed: optimizations.filter(o => o.status === 'completed').length,
        highPriority: optimizations.filter(o => o.priority === 'high' || o.priority === 'critical').length
      },
      trends: {
        recentReports: reports.slice(0, 5),
        reputationTrend: reports.slice(0, 10).map(r => ({
          date: r.createdAt,
          score: r.reputationScore,
          deliveryRate: r.deliveryRate
        }))
      }
    };

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error: any) {
    console.error('Error fetching deliverability dashboard:', error);
    res.status(500).json({
      error: 'Failed to fetch deliverability dashboard',
      message: error.message
    });
  }
});

export default router;