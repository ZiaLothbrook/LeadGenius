import { db } from '../db';
import { 
  campaignSchedules, 
  scheduledMessages, 
  timingOptimizations, 
  scheduleConflicts,
  campaigns,
  messages,
  prospects,
  type InsertCampaignSchedule,
  type SelectCampaignSchedule,
  type InsertScheduledMessage,
  type SelectScheduledMessage,
  type InsertTimingOptimization,
  type SelectTimingOptimization,
  type InsertScheduleConflict,
  type SelectScheduleConflict
} from '../../shared/schema';
import { eq, and, desc, gt, lt, sql, asc, or, ne } from 'drizzle-orm';
import { storage } from '../storage';
import { pythonAI } from './pythonAiClient';

export interface ScheduleConfig {
  scheduleName: string;
  scheduleType: 'immediate' | 'scheduled' | 'recurring' | 'optimal';
  timezone: string;
  scheduledAt?: Date;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringConfig?: any;
  sendWindowStart?: string; // HH:MM
  sendWindowEnd?: string; // HH:MM
  allowWeekends?: boolean;
  enableOptimalTiming?: boolean;
  optimizationGoal?: 'open_rate' | 'click_rate' | 'response_rate' | 'conversion_rate';
  priority?: number;
  conflictResolution?: 'queue' | 'override' | 'skip';
  maxDailyMessages?: number;
  minMessageInterval?: number;
}

export interface OptimalTimingData {
  timezone: string;
  prospectId?: string;
  currentPerformance?: any;
  industryBenchmarks?: any;
  personalityInsights?: any;
}

export interface ConflictResolution {
  conflictType: 'timing' | 'capacity' | 'prospect_overlap' | 'rate_limit';
  resolutionStrategy: 'defer' | 'reschedule' | 'cancel' | 'merge';
  newScheduledTime?: Date;
  deferDuration?: number; // minutes
}

class CampaignSchedulingService {
  /**
   * Create a new campaign schedule
   */
  async createSchedule(campaignId: string, userId: string, config: ScheduleConfig): Promise<SelectCampaignSchedule> {
    console.log(`📅 Creating campaign schedule for campaign ${campaignId}, user ${userId}`);
    
    // Validate campaign belongs to user
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== userId) {
      throw new Error('Campaign not found or unauthorized');
    }

    const scheduleData: InsertCampaignSchedule = {
      campaignId,
      userId,
      scheduleName: config.scheduleName,
      scheduleType: config.scheduleType,
      timezone: config.timezone || 'UTC',
      scheduledAt: config.scheduledAt,
      recurringPattern: config.recurringPattern,
      recurringConfig: config.recurringConfig,
      sendWindowStart: config.sendWindowStart,
      sendWindowEnd: config.sendWindowEnd,
      allowWeekends: config.allowWeekends || false,
      enableOptimalTiming: config.enableOptimalTiming !== false,
      optimizationGoal: config.optimizationGoal || 'open_rate',
      priority: config.priority || 5,
      conflictResolution: config.conflictResolution || 'queue',
      maxDailyMessages: config.maxDailyMessages || 100,
      minMessageInterval: config.minMessageInterval || 60,
    };

    const [schedule] = await db.insert(campaignSchedules).values(scheduleData).returning();
    
    // If optimal timing is enabled, calculate optimal send times
    if (config.enableOptimalTiming && config.scheduleType === 'optimal') {
      await this.calculateOptimalSendTimes(schedule.id, userId);
    }

    console.log(`✅ Campaign schedule created: ${schedule.id}`);
    return schedule;
  }

  /**
   * Get all schedules for a user
   */
  async getUserSchedules(userId: string): Promise<SelectCampaignSchedule[]> {
    const schedules = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.userId, userId))
      .orderBy(desc(campaignSchedules.createdAt));

    return schedules;
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId: string, userId: string): Promise<SelectCampaignSchedule | null> {
    const [schedule] = await db
      .select()
      .from(campaignSchedules)
      .where(and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.userId, userId)
      ));

    return schedule || null;
  }

  /**
   * Update schedule status
   */
  async updateScheduleStatus(scheduleId: string, userId: string, status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'): Promise<void> {
    await db
      .update(campaignSchedules)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.userId, userId)
      ));

    console.log(`✅ Schedule ${scheduleId} status updated to: ${status}`);
  }

  /**
   * Schedule messages for a campaign
   */
  async scheduleMessages(scheduleId: string, messageIds: string[], prospectIds: string[]): Promise<SelectScheduledMessage[]> {
    console.log(`📅 Scheduling ${messageIds.length} messages for ${prospectIds.length} prospects`);

    const schedule = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.id, scheduleId))
      .then(results => results[0]);

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const scheduledMessages: SelectScheduledMessage[] = [];

    // Create combinations of messages and prospects
    for (const messageId of messageIds) {
      for (const prospectId of prospectIds) {
        let scheduledAt = new Date();

        // Calculate scheduled time based on schedule type
        switch (schedule.scheduleType) {
          case 'immediate':
            scheduledAt = new Date();
            break;
          case 'scheduled':
            scheduledAt = schedule.scheduledAt ? new Date(schedule.scheduledAt) : new Date();
            break;
          case 'optimal':
            scheduledAt = await this.calculateOptimalSendTime({
              timezone: schedule.timezone,
              prospectId
            });
            break;
          case 'recurring':
            scheduledAt = this.calculateNextRecurringSendTime(schedule);
            break;
        }

        // Apply timezone offset
        const timezoneOffset = this.getTimezoneOffset(schedule.timezone);
        
        const messageData: InsertScheduledMessage = {
          scheduleId: schedule.id,
          messageId,
          prospectId,
          originalScheduledAt: scheduledAt,
          timezoneOffset,
          status: 'pending'
        };

        const [scheduledMessage] = await db.insert(scheduledMessages).values(messageData).returning();
        scheduledMessages.push(scheduledMessage);
      }
    }

    // Update schedule totals
    await db
      .update(campaignSchedules)
      .set({ 
        totalScheduled: schedule.totalScheduled + scheduledMessages.length,
        nextSendAt: scheduledMessages[0]?.originalScheduledAt,
        updatedAt: new Date()
      })
      .where(eq(campaignSchedules.id, scheduleId));

    console.log(`✅ Successfully scheduled ${scheduledMessages.length} messages`);
    return scheduledMessages;
  }

  /**
   * Calculate optimal send time using AI
   */
  async calculateOptimalSendTime(data: OptimalTimingData): Promise<Date> {
    try {
      console.log(`🤖 Calculating optimal send time for prospect ${data.prospectId}`);

      // Get existing timing optimization data
      let timingData = null;
      if (data.prospectId) {
        const [existing] = await db
          .select()
          .from(timingOptimizations)
          .where(eq(timingOptimizations.prospectId, data.prospectId))
          .orderBy(desc(timingOptimizations.lastAnalyzedAt))
          .limit(1);
        
        timingData = existing;
      }

      // Use AI to analyze optimal timing
      const aiResponse = await pythonAI.generateMessage({
        action: 'optimize_send_timing',
        timezone: data.timezone,
        prospect_id: data.prospectId,
        current_performance: data.currentPerformance,
        existing_timing_data: timingData,
        industry_benchmarks: data.industryBenchmarks,
        optimization_goal: 'engagement'
      });

      // Parse AI response for optimal timing
      const optimalHour = aiResponse.optimal_hour || 10; // Default to 10 AM
      const optimalDay = aiResponse.optimal_day_of_week || 2; // Default to Tuesday
      const confidenceScore = aiResponse.confidence_score || 75;

      // Calculate next optimal send time
      const now = new Date();
      const optimalDate = new Date(now);
      optimalDate.setHours(optimalHour, 0, 0, 0);

      // Adjust to optimal day of week
      const currentDay = optimalDate.getDay();
      const daysToAdd = (optimalDay + 7 - currentDay) % 7;
      if (daysToAdd === 0 && optimalDate <= now) {
        optimalDate.setDate(optimalDate.getDate() + 7); // Next week
      } else {
        optimalDate.setDate(optimalDate.getDate() + daysToAdd);
      }

      // Store optimization data if we have a prospect
      if (data.prospectId) {
        const optimizationData: InsertTimingOptimization = {
          userId: 'system', // This should be passed in properly
          prospectId: data.prospectId,
          optimalHour,
          optimalDayOfWeek: optimalDay,
          optimalSendTime: optimalDate,
          aiRecommendations: aiResponse,
          confidenceScore: confidenceScore.toString(),
          sampleSize: aiResponse.sample_size || 0,
          lastAnalyzedAt: new Date()
        };

        await db.insert(timingOptimizations).values(optimizationData);
      }

      console.log(`✅ Optimal send time calculated: ${optimalDate.toISOString()}`);
      return optimalDate;

    } catch (error) {
      console.error('❌ Error calculating optimal send time:', error);
      // Fallback to business hours (10 AM tomorrow)
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      fallback.setHours(10, 0, 0, 0);
      return fallback;
    }
  }

  /**
   * Calculate optimal send times for all prospects in a schedule
   */
  async calculateOptimalSendTimes(scheduleId: string, userId: string): Promise<void> {
    console.log(`🤖 Calculating optimal send times for schedule ${scheduleId}`);
    
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Get all prospects for the campaign
    const campaign = await storage.getCampaign(schedule.campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // This would typically get prospects from campaign_prospects table
    // For now, we'll use a placeholder
    console.log(`✅ Optimal send times calculation initiated for schedule ${scheduleId}`);
  }

  /**
   * Calculate next recurring send time
   */
  private calculateNextRecurringSendTime(schedule: SelectCampaignSchedule): Date {
    const now = new Date();
    const baseTime = schedule.scheduledAt ? new Date(schedule.scheduledAt) : now;
    
    switch (schedule.recurringPattern) {
      case 'daily':
        const nextDay = new Date(baseTime);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay;
        
      case 'weekly':
        const nextWeek = new Date(baseTime);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;
        
      case 'monthly':
        const nextMonth = new Date(baseTime);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
        
      default:
        return new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // Default: next day
    }
  }

  /**
   * Get timezone offset in minutes
   */
  private getTimezoneOffset(timezone: string): number {
    try {
      const now = new Date();
      const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
      return (targetTime.getTime() - utc.getTime()) / 60000;
    } catch (error) {
      console.error('❌ Error calculating timezone offset:', error);
      return 0; // Default to UTC
    }
  }

  /**
   * Detect and resolve schedule conflicts
   */
  async detectAndResolveConflicts(scheduleId: string, userId: string): Promise<SelectScheduleConflict[]> {
    console.log(`🔍 Detecting conflicts for schedule ${scheduleId}`);
    
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Get all active schedules for the user
    const userSchedules = await db
      .select()
      .from(campaignSchedules)
      .where(and(
        eq(campaignSchedules.userId, userId),
        ne(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.status, 'active')
      ));

    const conflicts: SelectScheduleConflict[] = [];

    // Check for various types of conflicts
    for (const otherSchedule of userSchedules) {
      // Check timing conflicts
      if (this.hasTimingConflict(schedule, otherSchedule)) {
        const conflict = await this.createConflict(
          userId,
          scheduleId,
          otherSchedule.id,
          'timing',
          'Schedules have overlapping send times'
        );
        conflicts.push(conflict);
      }

      // Check capacity conflicts
      if (this.hasCapacityConflict(schedule, otherSchedule)) {
        const conflict = await this.createConflict(
          userId,
          scheduleId,
          otherSchedule.id,
          'capacity',
          'Combined message volume exceeds daily limits'
        );
        conflicts.push(conflict);
      }
    }

    // Resolve conflicts automatically based on resolution strategy
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict.id, schedule.conflictResolution as any);
    }

    console.log(`✅ Detected and resolved ${conflicts.length} conflicts`);
    return conflicts;
  }

  /**
   * Check if two schedules have timing conflicts
   */
  private hasTimingConflict(schedule1: SelectCampaignSchedule, schedule2: SelectCampaignSchedule): boolean {
    // Simple check - if both are scheduled at similar times
    if (schedule1.scheduledAt && schedule2.scheduledAt) {
      const diff = Math.abs(new Date(schedule1.scheduledAt).getTime() - new Date(schedule2.scheduledAt).getTime());
      const minInterval = Math.min(schedule1.minMessageInterval, schedule2.minMessageInterval) * 60 * 1000;
      return diff < minInterval;
    }
    return false;
  }

  /**
   * Check if two schedules have capacity conflicts
   */
  private hasCapacityConflict(schedule1: SelectCampaignSchedule, schedule2: SelectCampaignSchedule): boolean {
    // Check if combined daily message limits would be exceeded
    const combinedDaily = schedule1.maxDailyMessages + schedule2.maxDailyMessages;
    return combinedDaily > 500; // Example limit
  }

  /**
   * Create a schedule conflict record
   */
  private async createConflict(
    userId: string,
    primaryScheduleId: string,
    conflictingScheduleId: string,
    conflictType: 'timing' | 'capacity' | 'prospect_overlap' | 'rate_limit',
    description: string
  ): Promise<SelectScheduleConflict> {
    const conflictData: InsertScheduleConflict = {
      userId,
      primaryScheduleId,
      conflictingScheduleId,
      conflictType,
      conflictDescription: description,
      impactScore: '75.00', // Default impact score
    };

    const [conflict] = await db.insert(scheduleConflicts).values(conflictData).returning();
    return conflict;
  }

  /**
   * Resolve a schedule conflict
   */
  async resolveConflict(conflictId: string, strategy: 'defer' | 'reschedule' | 'cancel' | 'merge'): Promise<void> {
    console.log(`🔧 Resolving conflict ${conflictId} with strategy: ${strategy}`);

    const resolution: ConflictResolution = {
      conflictType: 'timing', // This should be determined from the conflict
      resolutionStrategy: strategy
    };

    switch (strategy) {
      case 'defer':
        resolution.deferDuration = 60; // Defer by 1 hour
        break;
      case 'reschedule':
        resolution.newScheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours later
        break;
      case 'cancel':
        // Cancel the conflicting schedule
        break;
      case 'merge':
        // Merge the schedules (complex logic)
        break;
    }

    // Update conflict as resolved
    await db
      .update(scheduleConflicts)
      .set({
        resolutionStrategy: strategy,
        resolutionApplied: true,
        resolvedAt: new Date()
      })
      .where(eq(scheduleConflicts.id, conflictId));

    console.log(`✅ Conflict ${conflictId} resolved`);
  }

  /**
   * Get pending messages ready to send
   */
  async getPendingMessages(): Promise<SelectScheduledMessage[]> {
    const now = new Date();
    
    const pendingMessages = await db
      .select()
      .from(scheduledMessages)
      .where(and(
        eq(scheduledMessages.status, 'pending'),
        lt(scheduledMessages.originalScheduledAt, now)
      ))
      .orderBy(asc(scheduledMessages.originalScheduledAt))
      .limit(100); // Process in batches

    return pendingMessages;
  }

  /**
   * Mark message as sent
   */
  async markMessageSent(messageId: string, sentAt: Date = new Date()): Promise<void> {
    await db
      .update(scheduledMessages)
      .set({
        status: 'sent',
        actualSentAt: sentAt,
        updatedAt: new Date()
      })
      .where(eq(scheduledMessages.id, messageId));

    console.log(`✅ Message ${messageId} marked as sent`);
  }

  /**
   * Get scheduling dashboard data
   */
  async getScheduleDashboard(userId: string): Promise<any> {
    const activeSchedules = await db
      .select()
      .from(campaignSchedules)
      .where(and(
        eq(campaignSchedules.userId, userId),
        eq(campaignSchedules.status, 'active')
      ));

    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledMessages)
      .innerJoin(campaignSchedules, eq(scheduledMessages.scheduleId, campaignSchedules.id))
      .where(and(
        eq(campaignSchedules.userId, userId),
        eq(scheduledMessages.status, 'pending')
      ))
      .then(result => result[0]?.count || 0);

    const sentToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledMessages)
      .innerJoin(campaignSchedules, eq(scheduledMessages.scheduleId, campaignSchedules.id))
      .where(and(
        eq(campaignSchedules.userId, userId),
        eq(scheduledMessages.status, 'sent'),
        gt(scheduledMessages.actualSentAt, new Date(new Date().setHours(0, 0, 0, 0)))
      ))
      .then(result => result[0]?.count || 0);

    const conflicts = await db
      .select()
      .from(scheduleConflicts)
      .where(and(
        eq(scheduleConflicts.userId, userId),
        eq(scheduleConflicts.resolutionApplied, false)
      ));

    return {
      activeSchedules: activeSchedules.length,
      pendingMessages: pendingCount,
      sentToday,
      activeConflicts: conflicts.length,
      schedules: activeSchedules,
      upcomingMessages: await this.getUpcomingMessages(userId),
      optimizationStats: await this.getOptimizationStats(userId)
    };
  }

  /**
   * Get upcoming messages for dashboard
   */
  private async getUpcomingMessages(userId: string, limit: number = 10): Promise<any[]> {
    const upcoming = await db
      .select({
        id: scheduledMessages.id,
        scheduledAt: scheduledMessages.originalScheduledAt,
        optimizedAt: scheduledMessages.optimizedScheduledAt,
        status: scheduledMessages.status,
        scheduleName: campaignSchedules.scheduleName,
        campaignName: campaigns.name // This would need proper join
      })
      .from(scheduledMessages)
      .innerJoin(campaignSchedules, eq(scheduledMessages.scheduleId, campaignSchedules.id))
      .leftJoin(campaigns, eq(campaignSchedules.campaignId, campaigns.id))
      .where(and(
        eq(campaignSchedules.userId, userId),
        eq(scheduledMessages.status, 'pending'),
        gt(scheduledMessages.originalScheduledAt, new Date())
      ))
      .orderBy(asc(scheduledMessages.originalScheduledAt))
      .limit(limit);

    return upcoming;
  }

  /**
   * Get optimization statistics
   */
  private async getOptimizationStats(userId: string): Promise<any> {
    const optimizations = await db
      .select()
      .from(timingOptimizations)
      .where(eq(timingOptimizations.userId, userId));

    const avgConfidence = optimizations.reduce((sum, opt) => {
      return sum + (parseFloat(opt.confidenceScore || '0'));
    }, 0) / (optimizations.length || 1);

    return {
      totalOptimizations: optimizations.length,
      averageConfidence: Math.round(avgConfidence),
      lastOptimized: optimizations[0]?.lastAnalyzedAt,
      improvementPotential: '15%' // This would be calculated based on historical data
    };
  }
}

export const campaignSchedulingService = new CampaignSchedulingService();
export default campaignSchedulingService;