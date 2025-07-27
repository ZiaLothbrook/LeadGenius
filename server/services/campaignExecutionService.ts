import { emailVerificationService } from './emailVerificationService';
import { communicationService } from './communicationService';
import { messageGenerationService } from './messageGenerationService';
import { postmarkService } from './postmarkService';
import { linkedinMessagingService } from './linkedinMessagingService';
import { storage } from '../storage';
import type { Campaign, Prospect, Message } from '@shared/schema';

interface CampaignExecutionOptions {
  campaignId: string;
  prospectIds?: string[];
  channel: 'email' | 'sms' | 'call' | 'linkedin' | 'multi';
  testMode?: boolean;
}

interface ExecutionResult {
  campaignId: string;
  channel: string;
  totalProspects: number;
  successful: number;
  failed: number;
  skipped: number;
  details: {
    prospectId: string;
    name: string;
    status: 'sent' | 'failed' | 'skipped';
    reason?: string;
    deliveryId?: string;
  }[];
}

class CampaignExecutionService {
  constructor() {
    console.log('🚀 Campaign Execution Service initialized');
  }

  async executeCampaign(options: CampaignExecutionOptions): Promise<ExecutionResult> {
    const { campaignId, prospectIds, channel, testMode = false } = options;
    
    // Fetch campaign details
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get prospects for the campaign
    let prospects: Prospect[];
    if (prospectIds && prospectIds.length > 0) {
      prospects = await Promise.all(
        prospectIds.map(id => storage.getProspect(id))
      ).then(results => results.filter((p): p is Prospect => p !== undefined));
    } else {
      prospects = await storage.getCampaignProspectsWithDetails(campaignId);
    }

    const result: ExecutionResult = {
      campaignId,
      channel,
      totalProspects: prospects.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    // Execute based on channel
    switch (channel) {
      case 'email':
        return await this.executeEmailCampaign(campaign, prospects, result, testMode);
      case 'sms':
        return await this.executeSMSCampaign(campaign, prospects, result, testMode);
      case 'call':
        return await this.executeCallCampaign(campaign, prospects, result, testMode);
      case 'linkedin':
        return await this.executeLinkedInCampaign(campaign, prospects, result, testMode);
      case 'multi':
        return await this.executeMultiChannelCampaign(campaign, prospects, result, testMode);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private async executeEmailCampaign(
    campaign: Campaign,
    prospects: Prospect[],
    result: ExecutionResult,
    testMode: boolean
  ): Promise<ExecutionResult> {
    // First, verify all email addresses
    const emailValidations = await Promise.all(
      prospects.map(async (prospect) => {
        if (!prospect.email) {
          return { prospect, valid: false, reason: 'No email address' };
        }
        
        const validation = await emailVerificationService.verifyEmail(prospect.email);
        const isValid = validation.deliverability === 'deliverable';
        
        return {
          prospect,
          valid: isValid,
          reason: isValid ? undefined : `Email ${validation.deliverability}: ${validation.reason || 'verification failed'}`
        };
      })
    );

    // Process each prospect
    for (const { prospect, valid, reason } of emailValidations) {
      if (!valid) {
        result.skipped++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'skipped',
          reason: reason || 'Invalid email'
        });
        continue;
      }

      try {
        // Generate personalized message
        const messageResult = await messageGenerationService.generateMessage({
          prospect: {
            name: prospect.name,
            title: prospect.title || 'Professional',
            company: prospect.company || 'Unknown Company',
            industry: prospect.industry || 'General',
            email: prospect.email || undefined,
            context: { prospectId: prospect.id }
          },
          campaignContext: {
            productName: campaign.name,
            productDescription: campaign.messageTemplate || 'Our solution',
            valueProposition: 'Improve your business efficiency',
            callToAction: 'Schedule a demo'
          },
          messageOptions: {
            tone: (campaign.tone as any) || 'professional',
            length: 'medium',
            personalizationLevel: 'advanced',
            includeDataPoints: ['role', 'company', 'industry'],
            avoidTopics: []
          },
          templateType: 'cold-email'
        });

        if (testMode) {
          // In test mode, just validate but don't send
          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            reason: 'Test mode - email would be sent',
            deliveryId: `test_${Date.now()}`
          });
        } else {
          // Send email via Postmark with user context
          const emailResult = await postmarkService.sendEmail({
            to: prospect.email!,
            subject: messageResult.subject || 'Introduction',
            htmlContent: messageResult.body,
            tag: `campaign-${campaign.id}`,
            trackOpens: true,
            userId: campaign.userId
          });

          if (emailResult.status === 'sent') {
            result.successful++;
            result.details.push({
              prospectId: prospect.id,
              name: prospect.name,
              status: 'sent',
              reason: 'Email delivered via Postmark',
              deliveryId: emailResult.messageId
            });
          } else {
            result.failed++;
            result.details.push({
              prospectId: prospect.id,
              name: prospect.name,
              status: 'failed',
              reason: emailResult.error || 'Email delivery failed',
              deliveryId: emailResult.messageId || 'none'
            });
          }
          
          // Store the message for later sending
          await storage.createMessage({
            userId: campaign.userId,
            campaignId: campaign.id,
            prospectId: prospect.id,
            subject: messageResult.subject || 'Introduction',
            content: messageResult.body,
            type: 'email',
            tone: campaign.tone || 'professional',
            aiGenerated: true,
            confidenceScore: Math.round(messageResult.aiConfidence * 100)
          });
        }
      } catch (error: any) {
        result.failed++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return result;
  }

  private async executeSMSCampaign(
    campaign: Campaign,
    prospects: Prospect[],
    result: ExecutionResult,
    testMode: boolean
  ): Promise<ExecutionResult> {
    if (!communicationService.isConfigured()) {
      throw new Error('Twilio is not configured. Please add Twilio credentials.');
    }

    for (const prospect of prospects) {
      if (!prospect.phone) {
        result.skipped++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'skipped',
          reason: 'No phone number'
        });
        continue;
      }

      try {
        // Generate personalized SMS message
        const messageResult = await messageGenerationService.generateMessage({
          prospect: {
            name: prospect.name,
            title: prospect.title || 'Professional',
            company: prospect.company || 'Unknown Company', 
            industry: prospect.industry || 'General',
            email: prospect.email || undefined
          },
          campaignContext: {
            productName: campaign.name,
            productDescription: campaign.messageTemplate || 'Our solution',
            valueProposition: 'Quick value for your business',
            callToAction: 'Reply YES to learn more'
          },
          messageOptions: {
            tone: (campaign.tone as any) || 'casual',
            length: 'short',
            personalizationLevel: 'basic',
            includeDataPoints: ['name', 'company'],
            avoidTopics: []
          },
          templateType: 'cold-email'  // SMS will be handled by length constraint
        });

        const formattedPhone = communicationService.formatPhoneNumber(prospect.phone);
        
        if (testMode) {
          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            reason: `Test mode - SMS would be sent to ${formattedPhone}`,
            deliveryId: `test_sms_${Date.now()}`
          });
        } else {
          // Send actual SMS
          const smsResult = await communicationService.sendSMS({
            to: formattedPhone,
            body: messageResult.body.substring(0, 160) // SMS character limit
          });

          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            deliveryId: smsResult.sid
          });

          // Store the message
          await storage.createMessage({
            userId: campaign.userId,
            campaignId: campaign.id,
            prospectId: prospect.id,
            subject: 'SMS Outreach',
            content: messageResult.body.substring(0, 160),
            type: 'sms',
            tone: campaign.tone || 'professional',
            aiGenerated: true,
            confidenceScore: Math.round(messageResult.aiConfidence * 100)
          });
        }
      } catch (error: any) {
        result.failed++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return result;
  }

  private async executeCallCampaign(
    campaign: Campaign,
    prospects: Prospect[],
    result: ExecutionResult,
    testMode: boolean
  ): Promise<ExecutionResult> {
    if (!communicationService.isConfigured()) {
      throw new Error('Twilio is not configured. Please add Twilio credentials.');
    }

    // For calls, we need a TwiML endpoint - this would be implemented separately
    const twimlUrl = process.env.TWIML_URL || 'https://demo.twilio.com/welcome/voice/';

    for (const prospect of prospects) {
      if (!prospect.phone) {
        result.skipped++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'skipped',
          reason: 'No phone number'
        });
        continue;
      }

      try {
        const formattedPhone = communicationService.formatPhoneNumber(prospect.phone);
        
        if (testMode) {
          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            reason: `Test mode - Call would be made to ${formattedPhone}`,
            deliveryId: `test_call_${Date.now()}`
          });
        } else {
          // Make actual call
          const callResult = await communicationService.makeCall({
            to: formattedPhone,
            url: twimlUrl
          });

          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            deliveryId: callResult.sid
          });

          // Store the call record
          await storage.createMessage({
            userId: campaign.userId,
            campaignId: campaign.id,
            prospectId: prospect.id,
            subject: 'Voice Call',
            content: `Call initiated to ${formattedPhone}`,
            type: 'phone_script',
            tone: campaign.tone || 'professional',
            aiGenerated: false
          });
        }
      } catch (error: any) {
        result.failed++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return result;
  }

  private async executeMultiChannelCampaign(
    campaign: Campaign,
    prospects: Prospect[],
    result: ExecutionResult,
    testMode: boolean
  ): Promise<ExecutionResult> {
    // Multi-channel sends to all available channels for each prospect
    const combinedResult: ExecutionResult = {
      ...result,
      details: []
    };

    // Execute each channel
    const emailResult = await this.executeEmailCampaign(campaign, prospects, { ...result }, testMode);
    const smsResult = await this.executeSMSCampaign(campaign, prospects, { ...result }, testMode);

    // Combine results
    combinedResult.successful = emailResult.successful + smsResult.successful;
    combinedResult.failed = emailResult.failed + smsResult.failed;
    combinedResult.skipped = emailResult.skipped + smsResult.skipped;
    combinedResult.details = [...emailResult.details, ...smsResult.details];

    return combinedResult;
  }

  /**
   * Execute LinkedIn campaign with compliant messaging approach
   */
  private async executeLinkedInCampaign(
    campaign: Campaign,
    prospects: Prospect[],
    result: ExecutionResult,
    testMode: boolean
  ): Promise<ExecutionResult> {
    console.log(`🔗 Executing LinkedIn campaign: ${campaign.name}`);

    for (const prospect of prospects) {
      try {
        // Check if prospect has LinkedIn URL or sufficient info for LinkedIn outreach
        if (!prospect.linkedinUrl && !prospect.name) {
          result.skipped++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'skipped',
            reason: 'No LinkedIn profile information available'
          });
          continue;
        }

        // Generate LinkedIn connection request message
        const connectionMessage = await linkedinMessagingService.generateConnectionRequest(
          prospect,
          {
            productName: campaign.goal || 'Business opportunity',
            productDescription: campaign.messageTemplate || 'Professional connection',
            valueProposition: campaign.messageTemplate || 'Let\'s connect',
            callToAction: 'Connect with me'
          }
        );

        // Generate follow-up message for after connection acceptance
        const followUpMessage = await linkedinMessagingService.generateFollowUpMessage(
          prospect,
          {
            productName: campaign.goal || 'Business opportunity',
            productDescription: campaign.messageTemplate || 'Professional follow-up',
            valueProposition: campaign.messageTemplate || 'Let\'s discuss collaboration',
            callToAction: 'Schedule a brief call'
          }
        );

        if (testMode) {
          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            reason: 'LinkedIn messages prepared for manual sending',
            deliveryId: `linkedin_${connectionMessage.id}`
          });
        } else {
          // LinkedIn campaigns require manual execution due to compliance
          result.successful++;
          result.details.push({
            prospectId: prospect.id,
            name: prospect.name,
            status: 'sent',
            reason: 'LinkedIn message prepared - manual sending required',
            deliveryId: connectionMessage.id
          });
        }

        // Store connection request message
        await storage.createMessage({
          userId: campaign.userId,
          campaignId: campaign.id,
          prospectId: prospect.id,
          subject: 'LinkedIn Connection Request',
          content: connectionMessage.formattedContent,
          type: 'linkedin',
          tone: campaign.tone || 'professional',
          aiGenerated: true,
          confidenceScore: 85 // LinkedIn messages typically have good confidence
        });

        // Store follow-up message
        await storage.createMessage({
          userId: campaign.userId,
          campaignId: campaign.id,
          prospectId: prospect.id,
          subject: 'LinkedIn Follow-up Message',
          content: followUpMessage.formattedContent,
          type: 'linkedin',
          tone: campaign.tone || 'professional',
          aiGenerated: true,
          confidenceScore: 80
        });

      } catch (error: any) {
        result.failed++;
        result.details.push({
          prospectId: prospect.id,
          name: prospect.name,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return result;
  }

  async getDeliveryStatus(deliveryId: string, channel: string): Promise<string> {
    switch (channel) {
      case 'sms':
        return await communicationService.getMessageStatus(deliveryId);
      case 'call':
        return await communicationService.getCallStatus(deliveryId);
      case 'email':
        // Would check email service status when available
        return 'pending';
      case 'linkedin':
        // LinkedIn messages require manual tracking
        return 'prepared';
      default:
        return 'unknown';
    }
  }

  async validatePhoneNumbers(phoneNumbers: string[]): Promise<{ phone: string; valid: boolean; formatted: string }[]> {
    return phoneNumbers.map(phone => {
      try {
        const formatted = communicationService.formatPhoneNumber(phone);
        // Basic validation - check if it has enough digits
        const digits = formatted.replace(/\D/g, '');
        const valid = digits.length >= 10 && digits.length <= 15;
        
        return { phone, valid, formatted };
      } catch {
        return { phone, valid: false, formatted: phone };
      }
    });
  }
}

export const campaignExecutionService = new CampaignExecutionService();