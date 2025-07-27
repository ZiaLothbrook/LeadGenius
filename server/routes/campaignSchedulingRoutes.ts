import { Router } from 'express';
import { campaignSchedulingService } from '../services/campaignSchedulingService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createScheduleSchema = z.object({
  campaignId: z.string().min(1),
  scheduleName: z.string().min(1),
  scheduleType: z.enum(['immediate', 'scheduled', 'recurring', 'optimal']),
  timezone: z.string().default('UTC'),
  scheduledAt: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  recurringConfig: z.any().optional(),
  sendWindowStart: z.string().optional(), // HH:MM format
  sendWindowEnd: z.string().optional(), // HH:MM format
  allowWeekends: z.boolean().default(false),
  enableOptimalTiming: z.boolean().default(true),
  optimizationGoal: z.enum(['open_rate', 'click_rate', 'response_rate', 'conversion_rate']).default('open_rate'),
  priority: z.number().min(1).max(10).default(5),
  conflictResolution: z.enum(['queue', 'override', 'skip']).default('queue'),
  maxDailyMessages: z.number().positive().default(100),
  minMessageInterval: z.number().positive().default(60),
});

const scheduleMessagesSchema = z.object({
  messageIds: z.array(z.string()).min(1),
  prospectIds: z.array(z.string()).min(1),
});

// Get dashboard data
router.get('/dashboard', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const dashboard = await campaignSchedulingService.getScheduleDashboard(userId);
    res.json(dashboard);
  } catch (error: any) {
    console.error('❌ Error getting schedule dashboard:', error);
    res.status(500).json({ 
      message: 'Failed to get schedule dashboard',
      error: error.message 
    });
  }
});

// Create new schedule
router.post('/schedules', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = createScheduleSchema.parse(req.body);
    const schedule = await campaignSchedulingService.createSchedule(
      validatedData.campaignId,
      userId,
      validatedData
    );

    res.status(201).json(schedule);
  } catch (error: any) {
    console.error('❌ Error creating schedule:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    res.status(500).json({ 
      message: 'Failed to create schedule',
      error: error.message 
    });
  }
});

// Get all user schedules
router.get('/schedules', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const schedules = await campaignSchedulingService.getUserSchedules(userId);
    res.json(schedules);
  } catch (error: any) {
    console.error('❌ Error getting schedules:', error);
    res.status(500).json({ 
      message: 'Failed to get schedules',
      error: error.message 
    });
  }
});

// Get specific schedule
router.get('/schedules/:scheduleId', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { scheduleId } = req.params;
    const schedule = await campaignSchedulingService.getSchedule(scheduleId, userId);
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (error: any) {
    console.error('❌ Error getting schedule:', error);
    res.status(500).json({ 
      message: 'Failed to get schedule',
      error: error.message 
    });
  }
});

// Update schedule status
router.patch('/schedules/:scheduleId/status', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { scheduleId } = req.params;
    const { status } = req.body;

    if (!['draft', 'active', 'paused', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await campaignSchedulingService.updateScheduleStatus(scheduleId, userId, status);
    res.json({ message: 'Schedule status updated successfully' });
  } catch (error: any) {
    console.error('❌ Error updating schedule status:', error);
    res.status(500).json({ 
      message: 'Failed to update schedule status',
      error: error.message 
    });
  }
});

// Schedule messages
router.post('/schedules/:scheduleId/messages', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { scheduleId } = req.params;
    const validatedData = scheduleMessagesSchema.parse(req.body);

    const scheduledMessages = await campaignSchedulingService.scheduleMessages(
      scheduleId,
      validatedData.messageIds,
      validatedData.prospectIds
    );

    res.status(201).json({
      message: 'Messages scheduled successfully',
      scheduled: scheduledMessages.length,
      messages: scheduledMessages
    });
  } catch (error: any) {
    console.error('❌ Error scheduling messages:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    res.status(500).json({ 
      message: 'Failed to schedule messages',
      error: error.message 
    });
  }
});

// Calculate optimal send time
router.post('/optimal-timing', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { timezone, prospectId, currentPerformance, industryBenchmarks } = req.body;

    if (!timezone) {
      return res.status(400).json({ message: 'Timezone is required' });
    }

    const optimalTime = await campaignSchedulingService.calculateOptimalSendTime({
      timezone,
      prospectId,
      currentPerformance,
      industryBenchmarks
    });

    res.json({
      optimalSendTime: optimalTime,
      timezone,
      message: 'Optimal send time calculated successfully'
    });
  } catch (error: any) {
    console.error('❌ Error calculating optimal timing:', error);
    res.status(500).json({ 
      message: 'Failed to calculate optimal timing',
      error: error.message 
    });
  }
});

// Detect and resolve conflicts
router.post('/schedules/:scheduleId/resolve-conflicts', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { scheduleId } = req.params;
    const conflicts = await campaignSchedulingService.detectAndResolveConflicts(scheduleId, userId);

    res.json({
      message: 'Conflicts detected and resolved',
      conflictsFound: conflicts.length,
      conflicts
    });
  } catch (error: any) {
    console.error('❌ Error resolving conflicts:', error);
    res.status(500).json({ 
      message: 'Failed to resolve conflicts',
      error: error.message 
    });
  }
});

// Get pending messages (admin/system endpoint)
router.get('/pending-messages', async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const pendingMessages = await campaignSchedulingService.getPendingMessages();
    res.json({
      pending: pendingMessages.length,
      messages: pendingMessages
    });
  } catch (error: any) {
    console.error('❌ Error getting pending messages:', error);
    res.status(500).json({ 
      message: 'Failed to get pending messages',
      error: error.message 
    });
  }
});

// Mark message as sent (system endpoint)
router.patch('/messages/:messageId/sent', async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const { sentAt } = req.body;

    await campaignSchedulingService.markMessageSent(
      messageId, 
      sentAt ? new Date(sentAt) : new Date()
    );

    res.json({ message: 'Message marked as sent' });
  } catch (error: any) {
    console.error('❌ Error marking message as sent:', error);
    res.status(500).json({ 
      message: 'Failed to mark message as sent',
      error: error.message 
    });
  }
});

// Get timezone suggestions
router.get('/timezones', async (req: any, res) => {
  try {
    const timezones = [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
      { value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00' },
      { value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00' },
      { value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00' },
      { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
      { value: 'Europe/Paris', label: 'Central European Time', offset: '+01:00' },
      { value: 'Europe/Berlin', label: 'Berlin, Amsterdam, Stockholm', offset: '+01:00' },
      { value: 'Asia/Tokyo', label: 'Tokyo, Osaka, Sapporo', offset: '+09:00' },
      { value: 'Asia/Shanghai', label: 'Beijing, Shanghai, Hong Kong', offset: '+08:00' },
      { value: 'Asia/Kolkata', label: 'Mumbai, Kolkata, New Delhi', offset: '+05:30' },
      { value: 'Australia/Sydney', label: 'Sydney, Melbourne', offset: '+11:00' },
      { value: 'Pacific/Auckland', label: 'Auckland, Wellington', offset: '+13:00' },
    ];

    res.json({ timezones });
  } catch (error: any) {
    console.error('❌ Error getting timezones:', error);
    res.status(500).json({ 
      message: 'Failed to get timezones',
      error: error.message 
    });
  }
});

export default router;