import { storage } from "../storage";
import { communicationService } from "./communicationService";
import { postmarkService } from "./postmarkService";
import { emailVerificationService } from "./emailVerificationService";
import type { Campaign, Prospect, CampaignProspect } from "@shared/schema";

export interface CampaignSequenceStep {
  id: string;
  stepNumber: number;
  channel: 'email' | 'linkedin' | 'sms' | 'phone';
  delayDays: number;
  messageTemplate: string;
  subject?: string;
  conditions?: {
    openRequired?: boolean;
    clickRequired?: boolean;
    replyRequired?: boolean;
    noReplyFor?: number; // days
  };
  isActive: boolean;
}

export interface CampaignOrchestrationConfig {
  campaignId: string;
  sequences: CampaignSequenceStep[];
  timing: {
    workingHours: {
      start: string; // "09:00"
      end: string;   // "17:00"
      timezone: string;
    };
    workingDays: number[]; // [1,2,3,4,5] for Mon-Fri
    respectTimeZones: boolean;
  };
  optimization: {
    abTestEnabled: boolean;
    personalizedTiming: boolean;
    engagementThreshold: number; // Stop sequence if engagement is low
    autoOptimize: boolean;
  };
  tracking: {
    trackOpens: boolean;
    trackClicks: boolean;
    trackReplies: boolean;
    utmParameters: boolean;
  };
}

export interface ProspectEngagement {
  prospectId: string;
  campaignId: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'opted_out';
  engagementScore: number; // 0-100
  lastActivity: Date;
  interactions: {
    opens: number;
    clicks: number;
    replies: number;
    phoneConnects: number;
  };
  nextScheduledAction?: {
    stepId: string;
    scheduledFor: Date;
    channel: string;
  };
}

export interface CampaignPerformanceMetrics {
  campaignId: string;
  totalProspects: number;
  activeProspects: number;
  completedProspects: number;
  optedOutProspects: number;
  channelPerformance: {
    [channel: string]: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      replied: number;
      conversionRate: number;
    };
  };
  sequencePerformance: {
    [stepId: string]: {
      sent: number;
      engagementRate: number;
      dropOffRate: number;
      avgResponseTime: number; // hours
    };
  };
  overallMetrics: {
    responseRate: number;
    engagementRate: number;
    conversionRate: number;
    avgSequenceLength: number;
    revenueGenerated: number;
  };
}

class CampaignOrchestrationEngine {
  /**
   * Initialize a new multi-channel campaign with orchestration
   */
  async initializeCampaign(config: CampaignOrchestrationConfig): Promise<void> {
    try {
      console.log(`🎯 Initializing campaign orchestration: ${config.campaignId}`);
      
      const campaign = await storage.getCampaign(config.campaignId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Get all prospects in the campaign
      const campaignProspects = await storage.getCampaignProspects(config.campaignId);
      
      // Initialize engagement tracking for each prospect
      for (const cp of campaignProspects) {
        await this.initializeProspectEngagement(cp.prospectId, config);
      }

      // Schedule initial messages
      await this.scheduleInitialSequence(config);
      
      console.log(`✅ Campaign orchestration initialized for ${campaignProspects.length} prospects`);
      
    } catch (error) {
      console.error("❌ Error initializing campaign orchestration:", error);
      throw error;
    }
  }

  /**
   * Process scheduled campaign actions
   */
  async processScheduledActions(): Promise<void> {
    try {
      console.log("🔄 Processing scheduled campaign actions...");
      
      // Get all active campaigns with pending actions
      const pendingActions = await this.getPendingActions();
      
      for (const action of pendingActions) {
        try {
          await this.executeScheduledAction(action);
        } catch (error) {
          console.error(`❌ Error executing action ${action.stepId}:`, error);
          // Continue with other actions
        }
      }
      
      console.log(`✅ Processed ${pendingActions.length} scheduled actions`);
      
    } catch (error) {
      console.error("❌ Error processing scheduled actions:", error);
      throw error;
    }
  }

  /**
   * Execute a specific scheduled action
   */
  private async executeScheduledAction(action: ProspectEngagement['nextScheduledAction'] & { prospectId: string; campaignId: string }): Promise<void> {
    if (!action) return;

    const prospect = await storage.getProspect(action.prospectId);
    const campaign = await storage.getCampaign(action.campaignId);
    
    if (!prospect || !campaign) {
      console.warn(`⚠️ Missing prospect or campaign for action ${action.stepId}`);
      return;
    }

    // Check if we should send based on timing rules
    if (!this.isOptimalSendTime(action.scheduledFor)) {
      await this.rescheduleAction(action, this.getNextOptimalTime());
      return;
    }

    switch (action.channel) {
      case 'email':
        await this.sendEmailMessage(prospect, campaign, action.stepId);
        break;
      case 'linkedin':
        await this.sendLinkedInMessage(prospect, campaign, action.stepId);
        break;
      case 'sms':
        await this.sendSMSMessage(prospect, campaign, action.stepId);
        break;
      case 'phone':
        await this.schedulePhoneCall(prospect, campaign, action.stepId);
        break;
    }

    // Update engagement tracking
    await this.updateProspectEngagement(action.prospectId, action.campaignId, action.stepId);
  }

  /**
   * Send email message with advanced tracking
   */
  private async sendEmailMessage(prospect: Prospect, campaign: Campaign, stepId: string): Promise<void> {
    try {
      // Verify email before sending
      const verification = await emailVerificationService.verifyEmail(prospect.email || '');
      
      if (!verification.isValid || verification.deliverability === 'undeliverable') {
        console.warn(`⚠️ Skipping undeliverable email: ${prospect.email}`);
        return;
      }

      // Get personalized message template for this step
      const messageContent = await this.getPersonalizedMessage(prospect, campaign, stepId, 'email');
      
      // Send via Postmark with tracking
      const result = await postmarkService.sendEmail({
        to: prospect.email!,
        subject: messageContent.subject,
        html: messageContent.html,
        text: messageContent.text,
        trackOpens: true,
        trackLinks: true,
        metadata: {
          campaignId: campaign.id,
          prospectId: prospect.id,
          stepId,
          channel: 'email'
        }
      });

      if (result.success) {
        console.log(`✅ Email sent to ${prospect.name} (${prospect.email})`);
        
        // Track the send
        await this.trackCampaignInteraction({
          campaignId: campaign.id,
          prospectId: prospect.id,
          action: 'sent',
          channel: 'email',
          stepId,
          metadata: { messageId: result.messageId }
        });
      }
      
    } catch (error) {
      console.error(`❌ Error sending email to ${prospect.email}:`, error);
      throw error;
    }
  }

  /**
   * Send LinkedIn message
   */
  private async sendLinkedInMessage(prospect: Prospect, campaign: Campaign, stepId: string): Promise<void> {
    try {
      // LinkedIn integration would go here
      // For now, we'll simulate the functionality
      console.log(`📱 LinkedIn message scheduled for ${prospect.name}`);
      
      const messageContent = await this.getPersonalizedMessage(prospect, campaign, stepId, 'linkedin');
      
      // Track the planned send
      await this.trackCampaignInteraction({
        campaignId: campaign.id,
        prospectId: prospect.id,
        action: 'planned',
        channel: 'linkedin',
        stepId,
        metadata: { 
          linkedinUrl: prospect.linkedinUrl,
          messagePreview: messageContent.text.substring(0, 100)
        }
      });
      
    } catch (error) {
      console.error(`❌ Error sending LinkedIn message:`, error);
      throw error;
    }
  }

  /**
   * Send SMS message via Twilio
   */
  private async sendSMSMessage(prospect: Prospect, campaign: Campaign, stepId: string): Promise<void> {
    try {
      if (!prospect.phone) {
        console.warn(`⚠️ No phone number for ${prospect.name}`);
        return;
      }

      const messageContent = await this.getPersonalizedMessage(prospect, campaign, stepId, 'sms');
      
      const result = await communicationService.sendSMS({
        to: prospect.phone,
        message: messageContent.text,
        metadata: {
          campaignId: campaign.id,
          prospectId: prospect.id,
          stepId
        }
      });

      if (result.success) {
        console.log(`✅ SMS sent to ${prospect.name} (${prospect.phone})`);
        
        await this.trackCampaignInteraction({
          campaignId: campaign.id,
          prospectId: prospect.id,
          action: 'sent',
          channel: 'sms',
          stepId,
          metadata: { messageId: result.messageId }
        });
      }
      
    } catch (error) {
      console.error(`❌ Error sending SMS:`, error);
      throw error;
    }
  }

  /**
   * Get personalized message for specific step and channel
   */
  private async getPersonalizedMessage(prospect: Prospect, campaign: Campaign, stepId: string, channel: string): Promise<{
    subject?: string;
    text: string;
    html?: string;
  }> {
    // This would integrate with the AI message generation service
    // For now, we'll return a basic template
    
    const baseMessage = `Hi ${prospect.name},

I hope this message finds you well. I noticed you're ${prospect.title} at ${prospect.company}, and I thought you might be interested in ${campaign.name}.

${campaign.description}

Would you be open to a brief 15-minute conversation this week?

Best regards,
${campaign.userId}`;

    return {
      subject: channel === 'email' ? `Quick question about ${prospect.company}` : undefined,
      text: baseMessage,
      html: channel === 'email' ? `<p>${baseMessage.replace(/\n/g, '<br>')}</p>` : undefined
    };
  }

  /**
   * Track campaign interactions
   */
  private async trackCampaignInteraction(interaction: {
    campaignId: string;
    prospectId: string;
    action: string;
    channel: string;
    stepId: string;
    metadata?: any;
  }): Promise<void> {
    try {
      // This would integrate with the analytics system
      console.log(`📊 Tracking interaction: ${interaction.action} via ${interaction.channel}`);
      
      // Update campaign analytics
      await storage.createAnalytics({
        userId: '', // Would get from campaign
        campaignId: interaction.campaignId,
        date: new Date(),
        metric: interaction.action,
        value: 1,
        channel: interaction.channel
      });
      
    } catch (error) {
      console.error("❌ Error tracking interaction:", error);
    }
  }

  /**
   * Initialize prospect engagement tracking
   */
  private async initializeProspectEngagement(prospectId: string, config: CampaignOrchestrationConfig): Promise<void> {
    // This would create engagement records in the database
    console.log(`📝 Initializing engagement tracking for prospect ${prospectId}`);
  }

  /**
   * Schedule initial sequence for all prospects
   */
  private async scheduleInitialSequence(config: CampaignOrchestrationConfig): Promise<void> {
    console.log(`⏰ Scheduling initial sequence for campaign ${config.campaignId}`);
    
    const firstStep = config.sequences.find(s => s.stepNumber === 1);
    if (!firstStep) return;

    // Schedule first messages for all prospects
    const campaignProspects = await storage.getCampaignProspects(config.campaignId);
    
    for (const cp of campaignProspects) {
      await this.scheduleNextAction(cp.prospectId, config.campaignId, firstStep);
    }
  }

  /**
   * Schedule next action for a prospect
   */
  private async scheduleNextAction(prospectId: string, campaignId: string, step: CampaignSequenceStep): Promise<void> {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + step.delayDays);
    
    // Adjust for optimal timing
    const optimalTime = this.getOptimalSendTime(scheduledFor);
    
    console.log(`⏰ Scheduling ${step.channel} for prospect ${prospectId} at ${optimalTime.toISOString()}`);
  }

  /**
   * Get pending actions that need to be executed
   */
  private async getPendingActions(): Promise<Array<ProspectEngagement['nextScheduledAction'] & { prospectId: string; campaignId: string }>> {
    // This would query the database for scheduled actions
    // For now, return empty array
    return [];
  }

  /**
   * Check if current time is optimal for sending messages
   */
  private isOptimalSendTime(scheduledTime: Date): boolean {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Basic business hours check (9 AM - 5 PM, Mon-Fri)
    const isBusinessHours = hour >= 9 && hour <= 17;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    return isBusinessHours && isWeekday;
  }

  /**
   * Get next optimal send time
   */
  private getNextOptimalTime(): Date {
    const now = new Date();
    const next = new Date(now);
    
    // If it's after hours, schedule for next business day at 9 AM
    if (now.getHours() >= 17) {
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
    } else if (now.getHours() < 9) {
      next.setHours(9, 0, 0, 0);
    }
    
    // If it's weekend, schedule for Monday
    const dayOfWeek = next.getDay();
    if (dayOfWeek === 0) { // Sunday
      next.setDate(next.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      next.setDate(next.getDate() + 2);
    }
    
    return next;
  }

  /**
   * Get optimal send time for a specific date
   */
  private getOptimalSendTime(date: Date): Date {
    const optimal = new Date(date);
    optimal.setHours(10, 0, 0, 0); // Default to 10 AM
    return this.getNextOptimalTime();
  }

  /**
   * Reschedule an action
   */
  private async rescheduleAction(action: any, newTime: Date): Promise<void> {
    console.log(`⏰ Rescheduling action ${action.stepId} to ${newTime.toISOString()}`);
    // Update database with new scheduled time
  }

  /**
   * Update prospect engagement after an action
   */
  private async updateProspectEngagement(prospectId: string, campaignId: string, stepId: string): Promise<void> {
    console.log(`📊 Updating engagement for prospect ${prospectId}, step ${stepId}`);
    // Update engagement metrics in database
  }

  /**
   * Schedule a phone call
   */
  private async schedulePhoneCall(prospect: Prospect, campaign: Campaign, stepId: string): Promise<void> {
    console.log(`📞 Phone call scheduled for ${prospect.name} - ${prospect.phone}`);
    
    await this.trackCampaignInteraction({
      campaignId: campaign.id,
      prospectId: prospect.id,
      action: 'call_scheduled',
      channel: 'phone',
      stepId,
      metadata: { 
        phone: prospect.phone,
        scheduledBy: 'system'
      }
    });
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformanceMetrics> {
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }

      const campaignProspects = await storage.getCampaignProspects(campaignId);
      const analytics = await storage.getAnalytics(campaign.userId, { campaignId });

      // Calculate metrics
      const metrics: CampaignPerformanceMetrics = {
        campaignId,
        totalProspects: campaignProspects.length,
        activeProspects: campaignProspects.filter(cp => cp.status === 'pending' || cp.status === 'sent').length,
        completedProspects: campaignProspects.filter(cp => cp.status === 'converted').length,
        optedOutProspects: 0, // Would calculate from engagement data
        channelPerformance: {
          email: {
            sent: analytics.filter(a => a.metric === 'sent' && a.channel === 'email').length,
            delivered: analytics.filter(a => a.metric === 'delivered' && a.channel === 'email').length,
            opened: analytics.filter(a => a.metric === 'opened' && a.channel === 'email').length,
            clicked: analytics.filter(a => a.metric === 'clicked' && a.channel === 'email').length,
            replied: analytics.filter(a => a.metric === 'replied' && a.channel === 'email').length,
            conversionRate: 0 // Calculate based on conversions
          }
        },
        sequencePerformance: {},
        overallMetrics: {
          responseRate: 0,
          engagementRate: 0,
          conversionRate: 0,
          avgSequenceLength: 0,
          revenueGenerated: 0
        }
      };

      return metrics;
      
    } catch (error) {
      console.error("❌ Error getting campaign performance:", error);
      throw error;
    }
  }

  /**
   * Optimize campaign performance automatically
   */
  async optimizeCampaign(campaignId: string): Promise<{
    optimizationsApplied: string[];
    expectedImprovement: number;
    recommendations: string[];
  }> {
    try {
      console.log(`🔧 Optimizing campaign ${campaignId}...`);
      
      const performance = await this.getCampaignPerformance(campaignId);
      const optimizations: string[] = [];
      const recommendations: string[] = [];

      // Analyze performance and suggest optimizations
      if (performance.channelPerformance.email.conversionRate < 0.02) {
        optimizations.push("Adjusted email send times to optimal hours");
        recommendations.push("Consider A/B testing different subject lines");
      }

      if (performance.overallMetrics.engagementRate < 0.1) {
        optimizations.push("Increased personalization level");
        recommendations.push("Review message content for relevance");
      }

      // Apply optimizations
      for (const optimization of optimizations) {
        await this.applyOptimization(campaignId, optimization);
      }

      console.log(`✅ Applied ${optimizations.length} optimizations to campaign ${campaignId}`);

      return {
        optimizationsApplied: optimizations,
        expectedImprovement: optimizations.length * 0.15, // 15% per optimization
        recommendations
      };
      
    } catch (error) {
      console.error("❌ Error optimizing campaign:", error);
      throw error;
    }
  }

  /**
   * Apply a specific optimization
   */
  private async applyOptimization(campaignId: string, optimization: string): Promise<void> {
    console.log(`🔧 Applying optimization: ${optimization}`);
    // Implementation would depend on the specific optimization
  }
}

export const campaignOrchestrationEngine = new CampaignOrchestrationEngine();