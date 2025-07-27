/**
 * CARD-037: LinkedIn Messaging Integration
 * Compliant LinkedIn messaging system for manual outreach optimization
 */

import { messageGenerationService } from './messageGenerationService';
import type { Prospect } from '@shared/schema';

interface LinkedInMessageOptions {
  to: string; // LinkedIn profile URL or name
  content: string;
  messageType: 'connection_request' | 'message' | 'inmessage';
  connectionNote?: string;
  userId: string;
  campaignId?: string;
  prospectId?: string;
}

interface LinkedInMessageResult {
  id: string;
  status: 'prepared' | 'manual_send_required';
  to: string;
  content: string;
  connectionNote?: string;
  formattedContent: string;
  characterCount: number;
  complianceCheck: LinkedInComplianceResult;
  sendingGuidance: LinkedInSendingGuidance;
  createdAt: Date;
}

interface LinkedInComplianceResult {
  isCompliant: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  issues: Array<{
    type: string;
    severity: 'warning' | 'error';
    message: string;
    suggestion: string;
  }>;
  recommendations: string[];
}

interface LinkedInSendingGuidance {
  bestTimeToSend: string;
  personalizedElements: string[];
  complianceTips: string[];
  rateLimitingAdvice: string;
  followUpStrategy: string;
}

interface LinkedInCampaignMetrics {
  campaignId: string;
  totalPrepared: number;
  connectionRequestsSent: number;
  messagesResponseRate: number;
  connectionAcceptanceRate: number;
  meetingRequests: number;
  positiveReplies: number;
  totalEngagement: number;
  lastUpdated: Date;
}

interface LinkedInRateLimits {
  connectionRequests: {
    weekly: number;
    current: number;
    resetDate: Date;
  };
  messages: {
    daily: number;
    current: number;
    resetDate: Date;
  };
  profileViews: {
    daily: number;
    current: number;
    resetDate: Date;
  };
}

class LinkedInMessagingService {
  private rateLimits: Map<string, LinkedInRateLimits> = new Map();
  private campaignMetrics: Map<string, LinkedInCampaignMetrics> = new Map();
  private sentMessages: Map<string, LinkedInMessageResult[]> = new Map();

  constructor() {
    console.log('🔗 LinkedIn Messaging Service initialized (Compliance Mode)');
  }

  /**
   * Prepare LinkedIn message for manual sending
   */
  async prepareLinkedInMessage(options: LinkedInMessageOptions): Promise<LinkedInMessageResult> {
    try {
      console.log(`🔗 Preparing LinkedIn message for: ${options.to}`);

      // Format content for LinkedIn
      const formattedContent = this.formatForLinkedIn(options.content, options.messageType);
      
      // Perform compliance check
      const complianceCheck = await this.performComplianceCheck(formattedContent, options.messageType);
      
      // Generate sending guidance
      const sendingGuidance = await this.generateSendingGuidance(options);
      
      // Check rate limits
      await this.checkRateLimits(options.userId, options.messageType);
      
      const result: LinkedInMessageResult = {
        id: `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'prepared',
        to: options.to,
        content: options.content,
        connectionNote: options.connectionNote,
        formattedContent,
        characterCount: formattedContent.length,
        complianceCheck,
        sendingGuidance,
        createdAt: new Date()
      };

      // Store prepared message
      if (!this.sentMessages.has(options.userId)) {
        this.sentMessages.set(options.userId, []);
      }
      this.sentMessages.get(options.userId)!.push(result);

      console.log(`✅ LinkedIn message prepared (${formattedContent.length} chars)`);
      return result;

    } catch (error) {
      console.error('❌ Error preparing LinkedIn message:', error);
      throw error;
    }
  }

  /**
   * Generate LinkedIn connection request message
   */
  async generateConnectionRequest(prospect: Prospect, campaignContext: any): Promise<LinkedInMessageResult> {
    try {
      console.log(`🤝 Generating LinkedIn connection request for: ${prospect.name}`);

      // Generate personalized connection request using AI
      const messageRequest = {
        prospect: {
          name: prospect.name,
          title: prospect.title,
          company: prospect.company,
          industry: prospect.industry || 'Unknown'
        },
        campaignContext,
        messageOptions: {
          tone: 'professional' as const,
          length: 'short' as const,
          personalizationLevel: 'advanced' as const,
          includeDataPoints: ['name', 'company', 'title'],
          templateType: 'linkedin' as const
        },
        templateType: 'linkedin' as const
      };

      const aiMessage = await messageGenerationService.generateMessage(messageRequest);
      
      // LinkedIn connection requests have a 300-character limit
      const connectionNote = this.truncateForConnectionRequest(aiMessage.body);

      return await this.prepareLinkedInMessage({
        to: prospect.name,
        content: aiMessage.body,
        connectionNote,
        messageType: 'connection_request',
        userId: prospect.userId || 'unknown',
        prospectId: prospect.id
      });

    } catch (error) {
      console.error('❌ Error generating LinkedIn connection request:', error);
      throw error;
    }
  }

  /**
   * Generate LinkedIn follow-up message
   */
  async generateFollowUpMessage(prospect: Prospect, campaignContext: any, previousInteraction?: string): Promise<LinkedInMessageResult> {
    try {
      console.log(`💬 Generating LinkedIn follow-up message for: ${prospect.name}`);

      const messageRequest = {
        prospect: {
          name: prospect.name,
          title: prospect.title,
          company: prospect.company,
          industry: prospect.industry || 'Unknown'
        },
        campaignContext: {
          ...campaignContext,
          previousInteraction: previousInteraction || 'Connection accepted'
        },
        messageOptions: {
          tone: 'friendly' as const,
          length: 'medium' as const,
          personalizationLevel: 'hyper-personalized' as const,
          includeDataPoints: ['name', 'company', 'title', 'industry'],
          templateType: 'follow-up' as const
        },
        templateType: 'linkedin' as const
      };

      const aiMessage = await messageGenerationService.generateMessage(messageRequest);

      return await this.prepareLinkedInMessage({
        to: prospect.name,
        content: aiMessage.body,
        messageType: 'message',
        userId: prospect.userId || 'unknown',
        prospectId: prospect.id
      });

    } catch (error) {
      console.error('❌ Error generating LinkedIn follow-up message:', error);
      throw error;
    }
  }

  /**
   * Record LinkedIn campaign interaction (manual input)
   */
  async recordInteraction(userId: string, campaignId: string, interaction: {
    prospectId: string;
    interactionType: 'connection_sent' | 'connection_accepted' | 'message_sent' | 'reply_received' | 'meeting_scheduled';
    timestamp?: Date;
    notes?: string;
  }): Promise<void> {
    try {
      console.log(`📊 Recording LinkedIn interaction: ${interaction.interactionType}`);

      // Update campaign metrics
      const metrics = this.campaignMetrics.get(campaignId) || {
        campaignId,
        totalPrepared: 0,
        connectionRequestsSent: 0,
        messagesResponseRate: 0,
        connectionAcceptanceRate: 0,
        meetingRequests: 0,
        positiveReplies: 0,
        totalEngagement: 0,
        lastUpdated: new Date()
      };

      // Update metrics based on interaction type
      switch (interaction.interactionType) {
        case 'connection_sent':
          metrics.connectionRequestsSent++;
          break;
        case 'connection_accepted':
          metrics.connectionAcceptanceRate = (metrics.connectionAcceptanceRate + 1) / metrics.connectionRequestsSent;
          break;
        case 'reply_received':
          metrics.positiveReplies++;
          break;
        case 'meeting_scheduled':
          metrics.meetingRequests++;
          break;
      }

      metrics.totalEngagement++;
      metrics.lastUpdated = new Date();
      
      this.campaignMetrics.set(campaignId, metrics);

      // Update rate limits
      await this.updateRateLimits(userId, interaction.interactionType);

      console.log(`✅ LinkedIn interaction recorded: ${interaction.interactionType}`);

    } catch (error) {
      console.error('❌ Error recording LinkedIn interaction:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn campaign analytics
   */
  async getCampaignMetrics(campaignId: string): Promise<LinkedInCampaignMetrics | null> {
    return this.campaignMetrics.get(campaignId) || null;
  }

  /**
   * Get user's current rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<LinkedInRateLimits> {
    return this.rateLimits.get(userId) || {
      connectionRequests: {
        weekly: 100,
        current: 0,
        resetDate: this.getNextWeekReset()
      },
      messages: {
        daily: 50,
        current: 0,
        resetDate: this.getNextDayReset()
      },
      profileViews: {
        daily: 80,
        current: 0,
        resetDate: this.getNextDayReset()
      }
    };
  }

  /**
   * Get LinkedIn compliance guidelines
   */
  getComplianceGuidelines(): {
    rateLimits: Record<string, string>;
    bestPractices: string[];
    prohibitedActions: string[];
    recommendations: string[];
  } {
    return {
      rateLimits: {
        'Connection Requests': 'Maximum 100 per week',
        'Messages to Connections': 'Maximum 50 per day',
        'Profile Views': 'Maximum 80 per day',
        'InMail Messages': 'Based on subscription tier'
      },
      bestPractices: [
        'Personalize every connection request with relevant context',
        'Wait 2-3 days between connection and first message',
        'Keep messages conversational and value-focused',
        'Respond to replies within 24-48 hours',
        'Use LinkedIn during business hours in target timezone',
        'Maintain a professional profile with recent activity'
      ],
      prohibitedActions: [
        'Using automation tools or bots',
        'Sending generic, mass messages',
        'Scraping profile data',
        'Creating fake profiles',
        'Excessive connection requests to strangers',
        'Sending spam or irrelevant content'
      ],
      recommendations: [
        'Build relationships before pitching products',
        'Share valuable content regularly',
        'Engage with prospects\' posts before reaching out',
        'Use LinkedIn Sales Navigator for better targeting',
        'Track response rates and optimize messaging',
        'Follow up strategically without being pushy'
      ]
    };
  }

  /**
   * Format content specifically for LinkedIn
   */
  private formatForLinkedIn(content: string, messageType: 'connection_request' | 'message' | 'inmessage'): string {
    let formattedContent = content;

    // Remove email-specific formatting
    formattedContent = formattedContent.replace(/Subject:.*\n/g, '');
    formattedContent = formattedContent.replace(/Dear\s+/g, 'Hi ');
    formattedContent = formattedContent.replace(/Sincerely,?|Best regards,?|Kind regards,?/gi, 'Best,');

    // LinkedIn-specific optimizations
    switch (messageType) {
      case 'connection_request':
        // Connection requests are limited to 300 characters
        formattedContent = this.truncateForConnectionRequest(formattedContent);
        break;
      case 'message':
        // Regular messages should be conversational
        formattedContent = this.makeConversational(formattedContent);
        break;
      case 'inmessage':
        // InMail messages can be longer but should be professional
        formattedContent = this.optimizeForInMail(formattedContent);
        break;
    }

    return formattedContent.trim();
  }

  /**
   * Truncate content for LinkedIn connection requests (300 char limit)
   */
  private truncateForConnectionRequest(content: string): string {
    if (content.length <= 300) return content;

    // Find the best truncation point (end of sentence or comma)
    let truncated = content.substring(0, 280);
    const lastSentence = truncated.lastIndexOf('.');
    const lastComma = truncated.lastIndexOf(',');
    
    if (lastSentence > 200) {
      return content.substring(0, lastSentence + 1);
    } else if (lastComma > 200) {
      return content.substring(0, lastComma) + '.';
    } else {
      return truncated + '...';
    }
  }

  /**
   * Make content more conversational for LinkedIn
   */
  private makeConversational(content: string): string {
    return content
      .replace(/\bI hope this message finds you well\b/gi, "Hope you're doing well")
      .replace(/\bI would like to\b/gi, "I'd love to")
      .replace(/\bI am writing to\b/gi, "I wanted to reach out because")
      .replace(/\bplease let me know\b/gi, "let me know")
      .replace(/\bI look forward to hearing from you\b/gi, "Looking forward to your thoughts");
  }

  /**
   * Optimize content for LinkedIn InMail
   */
  private optimizeForInMail(content: string): string {
    // InMail can be more formal but should still be engaging
    return content
      .replace(/\bDear Sir\/Madam\b/gi, 'Hello')
      .replace(/\bTo Whom It May Concern\b/gi, 'Hello');
  }

  /**
   * Perform compliance check on message content
   */
  private async performComplianceCheck(content: string, messageType: string): Promise<LinkedInComplianceResult> {
    const issues: LinkedInComplianceResult['issues'] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for spam triggers
    const spamWords = ['guarantee', 'free', 'limited time', 'act now', 'exclusive offer'];
    const contentLower = content.toLowerCase();
    
    spamWords.forEach(word => {
      if (contentLower.includes(word)) {
        issues.push({
          type: 'spam_trigger',
          severity: 'warning',
          message: `Contains potential spam trigger word: "${word}"`,
          suggestion: 'Consider rephrasing to avoid triggering spam filters'
        });
        riskLevel = 'medium';
      }
    });

    // Check character limits
    if (messageType === 'connection_request' && content.length > 300) {
      issues.push({
        type: 'character_limit',
        severity: 'error',
        message: 'Connection request exceeds 300 character limit',
        suggestion: 'Shorten message to meet LinkedIn requirements'
      });
      riskLevel = 'high';
    }

    // Check for personalization
    if (!content.match(/\b[A-Z][a-z]+\b/)) {
      issues.push({
        type: 'personalization',
        severity: 'warning',
        message: 'Message appears to lack personalization',
        suggestion: 'Add prospect name or company-specific details'
      });
    }

    // Generate recommendations based on analysis
    if (issues.length === 0) {
      recommendations.push('Message appears compliant and ready to send');
    } else {
      recommendations.push('Review and address flagged issues before sending');
    }

    return {
      isCompliant: issues.filter(i => i.severity === 'error').length === 0,
      riskLevel,
      issues,
      recommendations
    };
  }

  /**
   * Generate sending guidance for optimal results
   */
  private async generateSendingGuidance(options: LinkedInMessageOptions): Promise<LinkedInSendingGuidance> {
    return {
      bestTimeToSend: this.getBestSendingTime(),
      personalizedElements: this.extractPersonalizedElements(options.content),
      complianceTips: [
        'Send during business hours in recipient\'s timezone',
        'Wait for connection acceptance before sending messages',
        'Keep follow-ups spaced 3-5 days apart',
        'Engage with their content before reaching out'
      ],
      rateLimitingAdvice: 'Stay within 100 weekly connection requests and 50 daily messages',
      followUpStrategy: options.messageType === 'connection_request' 
        ? 'Wait 2-3 days after connection acceptance before sending first message'
        : 'Follow up in 5-7 days if no response, max 2 follow-ups'
    };
  }

  /**
   * Get optimal sending time based on business hours
   */
  private getBestSendingTime(): string {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 9) return 'Wait until 9 AM local time';
    if (hour > 17) return 'Wait until tomorrow morning (9-11 AM optimal)';
    if (hour >= 9 && hour <= 11) return 'Optimal time - send now';
    if (hour >= 14 && hour <= 16) return 'Good time - send now';
    return 'Consider waiting until optimal hours (9-11 AM or 2-4 PM)';
  }

  /**
   * Extract personalized elements from content
   */
  private extractPersonalizedElements(content: string): string[] {
    const elements: string[] = [];
    
    // Look for common personalization patterns
    if (content.match(/\b[A-Z][a-z]+\b/)) elements.push('Name mention');
    if (content.match(/\b[A-Z][a-z]+\s+(Inc|LLC|Corp|Company|Ltd)\b/)) elements.push('Company name');
    if (content.match(/\b(CEO|CTO|VP|Director|Manager)\b/i)) elements.push('Job title');
    if (content.match(/\b(recently|announced|launched|joined)\b/i)) elements.push('Recent activity');
    
    return elements;
  }

  /**
   * Check user's current rate limits
   */
  private async checkRateLimits(userId: string, messageType: string): Promise<void> {
    const limits = await this.getRateLimitStatus(userId);
    
    switch (messageType) {
      case 'connection_request':
        if (limits.connectionRequests.current >= limits.connectionRequests.weekly) {
          throw new Error('Weekly connection request limit reached. Reset date: ' + limits.connectionRequests.resetDate.toDateString());
        }
        break;
      case 'message':
        if (limits.messages.current >= limits.messages.daily) {
          throw new Error('Daily message limit reached. Reset date: ' + limits.messages.resetDate.toDateString());
        }
        break;
    }
  }

  /**
   * Update rate limits after interaction
   */
  private async updateRateLimits(userId: string, interactionType: string): Promise<void> {
    const limits = await this.getRateLimitStatus(userId);
    
    switch (interactionType) {
      case 'connection_sent':
        limits.connectionRequests.current++;
        break;
      case 'message_sent':
        limits.messages.current++;
        break;
    }
    
    this.rateLimits.set(userId, limits);
  }

  /**
   * Get next week reset date
   */
  private getNextWeekReset(): Date {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + (7 - now.getDay()));
    nextWeek.setHours(0, 0, 0, 0);
    return nextWeek;
  }

  /**
   * Get next day reset date
   */
  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}

export const linkedinMessagingService = new LinkedInMessagingService();