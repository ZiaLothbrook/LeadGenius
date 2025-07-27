import * as postmark from 'postmark';

export interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  from?: string;
  fromName?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  tag?: string;
  trackOpens?: boolean;
  trackLinks?: 'None' | 'HtmlAndText' | 'HtmlOnly' | 'TextOnly';
  userId?: string; // For user-specific servers
}

export interface EmailResult {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
  to: string;
  submittedAt: Date;
}

export interface BulkEmailResult {
  successful: number;
  failed: number;
  total: number;
  details: EmailResult[];
}

class PostmarkService {
  private defaultClient: postmark.ServerClient | null = null;
  private defaultApiKey: string | undefined;
  private defaultFromEmail: string;
  private defaultFromName: string;
  private userClients: Map<string, postmark.ServerClient> = new Map();

  constructor() {
    this.defaultApiKey = process.env.POSTMARK_API_KEY;
    this.defaultFromEmail = process.env.POSTMARK_FROM_EMAIL || 'noreply@leadgen.ai';
    this.defaultFromName = process.env.POSTMARK_FROM_NAME || 'AI Lead Generation Platform';

    if (this.defaultApiKey) {
      this.defaultClient = new postmark.ServerClient(this.defaultApiKey);
      console.log('✅ Postmark email service initialized with default server');
    } else {
      console.warn('⚠️  POSTMARK_API_KEY not configured - using user-specific servers only');
    }
  }

  /**
   * Get or create a Postmark client for a specific user
   */
  private async getUserClient(userId?: string): Promise<postmark.ServerClient | null> {
    // If no userId provided, use default client
    if (!userId) {
      return this.defaultClient;
    }

    // Check if we already have a client for this user
    if (this.userClients.has(userId)) {
      return this.userClients.get(userId)!;
    }

    // Try to get user's server configuration
    try {
      const { storage } = await import('../storage');
      const user = await storage.getUser(userId);
      
      if (user?.postmarkServerToken) {
        const client = new postmark.ServerClient(user.postmarkServerToken);
        this.userClients.set(userId, client);
        console.log(`✅ Created Postmark client for user ${userId} with dedicated server`);
        return client;
      }
    } catch (error) {
      console.error(`Failed to get user-specific Postmark client for ${userId}:`, error);
    }

    // Fallback to default client
    return this.defaultClient;
  }

  /**
   * Get user's email configuration (from address, name, etc.)
   */
  private async getUserEmailConfig(userId?: string) {
    if (!userId) {
      return {
        fromEmail: this.defaultFromEmail,
        fromName: this.defaultFromName
      };
    }

    try {
      const { storage } = await import('../storage');
      const user = await storage.getUser(userId);
      
      return {
        fromEmail: user?.postmarkFromEmail || user?.email || this.defaultFromEmail,
        fromName: user?.postmarkFromName || `${user?.firstName || 'Lead'} ${user?.lastName || 'Generation'}` || this.defaultFromName
      };
    } catch (error) {
      console.error(`Failed to get user email config for ${userId}:`, error);
      return {
        fromEmail: this.defaultFromEmail,
        fromName: this.defaultFromName
      };
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const client = await this.getUserClient(options.userId);
    if (!client) {
      console.warn('Postmark not configured - email not sent');
      return this.getMockEmailResult(options);
    }

    const emailConfig = await this.getUserEmailConfig(options.userId);

    try {
      const emailData: postmark.Models.Message = {
        From: `${options.fromName || emailConfig.fromName} <${options.from || emailConfig.fromEmail}>`,
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.htmlContent,
        TextBody: options.textContent || this.htmlToText(options.htmlContent),
        Tag: options.tag || 'leadgen-campaign',
        TrackOpens: options.trackOpens !== false,
      };

      // Use template if provided
      if (options.templateId && options.templateData) {
        const templateData = {
          From: emailData.From,
          To: emailData.To,
          Subject: emailData.Subject,
          TemplateId: parseInt(options.templateId),
          TemplateModel: options.templateData,
          Tag: emailData.Tag,
          TrackOpens: emailData.TrackOpens,
        };

        const response = await client.sendEmailWithTemplate(templateData);
        
        return {
          messageId: response.MessageID,
          status: 'sent',
          to: options.to,
          submittedAt: new Date(response.SubmittedAt),
        };
      } else {
        const response = await client.sendEmail(emailData);
        
        return {
          messageId: response.MessageID,
          status: 'sent',
          to: options.to,
          submittedAt: new Date(response.SubmittedAt),
        };
      }
    } catch (error: any) {
      console.error('Postmark email error:', {
        message: error.message,
        errorCode: error.code,
        statusCode: error.statusCode,
        to: options.to,
      });

      return {
        messageId: '',
        status: 'failed',
        error: error.message,
        to: options.to,
        submittedAt: new Date(),
      };
    }
  }

  async sendBulkEmails(emails: EmailOptions[]): Promise<BulkEmailResult> {
    // Group emails by userId to use appropriate client
    const emailsByUser = new Map<string, EmailOptions[]>();
    
    for (const email of emails) {
      const userId = email.userId || 'default';
      if (!emailsByUser.has(userId)) {
        emailsByUser.set(userId, []);
      }
      emailsByUser.get(userId)!.push(email);
    }

    const allDetails: EmailResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process emails by user group
    for (const [userId, userEmails] of emailsByUser) {
      const client = await this.getUserClient(userId === 'default' ? undefined : userId);
      if (!client) {
        // Add mock results for failed emails
        const mockDetails = userEmails.map(email => this.getMockEmailResult(email));
        allDetails.push(...mockDetails);
        failed += userEmails.length;
        continue;
      }

      const emailConfig = await this.getUserEmailConfig(userId === 'default' ? undefined : userId);

      try {
        const emailBatch = userEmails.map(options => ({
          From: `${options.fromName || emailConfig.fromName} <${options.from || emailConfig.fromEmail}>`,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.htmlContent,
          TextBody: options.textContent || this.htmlToText(options.htmlContent),
          Tag: options.tag || 'leadgen-campaign',
          TrackOpens: options.trackOpens !== false,
        }));

        const responses = await client.sendEmailBatch(emailBatch);
        
        responses.forEach((response, index) => {
          const originalEmail = userEmails[index];
          if (response.ErrorCode === 0) {
            successful++;
            allDetails.push({
              messageId: response.MessageID,
              status: 'sent',
              to: originalEmail.to,
              submittedAt: new Date(response.SubmittedAt),
            });
          } else {
            failed++;
            allDetails.push({
              messageId: '',
              status: 'failed',
              error: response.Message,
              to: originalEmail.to,
              submittedAt: new Date(),
            });
          }
        });
      } catch (error: any) {
        console.error(`Bulk email error for user ${userId}:`, error);
        // Add failed results for this batch
        const errorDetails = userEmails.map(email => ({
          messageId: '',
          status: 'failed' as const,
          error: error.message,
          to: email.to,
          submittedAt: new Date(),
        }));
        allDetails.push(...errorDetails);
        failed += userEmails.length;
      }
    }

    return {
      successful,
      failed,
      total: emails.length,
      details: allDetails,
    };
  }

  private getMockEmailResult(options: EmailOptions): EmailResult {
    return {
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      to: options.to,
      submittedAt: new Date(),
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|h[1-6])\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  getConfiguration() {
    return {
      configured: !!this.defaultApiKey,
      defaultServerAvailable: !!this.defaultClient,
      userSpecificServersEnabled: true,
      features: {
        singleEmail: true,
        bulkEmail: true,
        templates: true,
        tracking: true,
        userSpecificServers: true,
      }
    };
  }

  /**
   * Clear cached client for a user (useful when server config changes)
   */
  clearUserClient(userId: string) {
    this.userClients.delete(userId);
  }

  /**
   * Get stats about active user clients
   */
  getActiveUserClients() {
    return {
      totalActiveClients: this.userClients.size,
      userIds: Array.from(this.userClients.keys()),
    };
  }
}

export const postmarkService = new PostmarkService();