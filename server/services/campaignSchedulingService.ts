/**
 * Campaign Scheduling Service
 * Manages campaign timing, automation, and scheduled execution
 */

import { storage } from '../storage';

export interface CampaignScheduleConfig {
  campaignId: string;
  startDate: Date;
  timezone: string;
  sendWindow: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  allowWeekends: boolean;
  maxDailyMessages?: number;
  minMessageInterval?: number; // minutes
}

export class CampaignSchedulingService {
  /**
   * Create a campaign schedule
   */
  async createCampaignSchedule(config: CampaignScheduleConfig): Promise<string> {
    try {
      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await storage.db.execute(`
        INSERT INTO campaign_schedules (
          id, campaign_id, user_id, schedule_name, schedule_type, timezone,
          scheduled_at, send_window_start, send_window_end, allow_weekends,
          max_daily_messages, min_message_interval, status, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        scheduleId,
        config.campaignId,
        '', // Will be set by campaign creation
        'Default Schedule',
        'immediate',
        config.timezone,
        config.startDate.toISOString(),
        config.sendWindow.start,
        config.sendWindow.end,
        config.allowWeekends,
        config.maxDailyMessages || 50,
        config.minMessageInterval || 15,
        'pending',
        1
      ]);

      console.log('📅 Campaign schedule created:', scheduleId);
      return scheduleId;

    } catch (error) {
      console.error('❌ Schedule creation failed:', error);
      throw new Error(`Schedule creation failed: ${error.message}`);
    }
  }

  /**
   * Start campaign execution
   */
  async startCampaignExecution(campaignId: string): Promise<void> {
    try {
      await storage.db.execute(`
        UPDATE campaign_schedules 
        SET status = 'active', next_send_at = NOW() 
        WHERE campaign_id = ?
      `, [campaignId]);

      console.log('▶️ Campaign execution started:', campaignId);

    } catch (error) {
      console.error('❌ Campaign start failed:', error);
      throw new Error(`Campaign start failed: ${error.message}`);
    }
  }

  /**
   * Pause campaign execution
   */
  async pauseCampaignExecution(campaignId: string): Promise<void> {
    try {
      await storage.db.execute(`
        UPDATE campaign_schedules 
        SET status = 'paused' 
        WHERE campaign_id = ?
      `, [campaignId]);

      console.log('⏸️ Campaign execution paused:', campaignId);

    } catch (error) {
      console.error('❌ Campaign pause failed:', error);
      throw new Error(`Campaign pause failed: ${error.message}`);
    }
  }

  /**
   * Get optimal send time for a prospect
   */
  async getOptimalSendTime(campaignId: string, prospectId: string): Promise<Date> {
    try {
      // Get schedule configuration
      const schedule = await storage.db.get(`
        SELECT * FROM campaign_schedules WHERE campaign_id = ?
      `, [campaignId]);

      if (!schedule) {
        throw new Error('Campaign schedule not found');
      }

      // Calculate optimal send time based on schedule
      const now = new Date();
      const [startHour, startMinute] = schedule.send_window_start.split(':').map(Number);
      const [endHour, endMinute] = schedule.send_window_end.split(':').map(Number);

      let sendTime = new Date();
      sendTime.setHours(startHour, startMinute, 0, 0);

      // If current time is past send window, schedule for next day
      if (now.getHours() > endHour || (now.getHours() === endHour && now.getMinutes() > endMinute)) {
        sendTime.setDate(sendTime.getDate() + 1);
      }

      // Skip weekends if not allowed
      if (!schedule.allow_weekends) {
        while (sendTime.getDay() === 0 || sendTime.getDay() === 6) {
          sendTime.setDate(sendTime.getDate() + 1);
        }
      }

      return sendTime;

    } catch (error) {
      console.error('❌ Optimal time calculation failed:', error);
      // Return a default time (next business day at 9 AM)
      const defaultTime = new Date();
      defaultTime.setDate(defaultTime.getDate() + 1);
      defaultTime.setHours(9, 0, 0, 0);
      return defaultTime;
    }
  }

  /**
   * Check if campaign can send now
   */
  async canSendNow(campaignId: string): Promise<boolean> {
    try {
      const schedule = await storage.db.get(`
        SELECT * FROM campaign_schedules WHERE campaign_id = ? AND status = 'active'
      `, [campaignId]);

      if (!schedule) {
        return false;
      }

      const now = new Date();
      const [startHour, startMinute] = schedule.send_window_start.split(':').map(Number);
      const [endHour, endMinute] = schedule.send_window_end.split(':').map(Number);

      // Check if current time is within send window
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      const withinWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

      // Check weekend restriction
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const weekendAllowed = schedule.allow_weekends || !isWeekend;

      return withinWindow && weekendAllowed;

    } catch (error) {
      console.error('❌ Send time check failed:', error);
      return false;
    }
  }
}

export const campaignSchedulingService = new CampaignSchedulingService();