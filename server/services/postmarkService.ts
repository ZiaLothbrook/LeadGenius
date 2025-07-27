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
  private client: postmark.ServerClient | null = null;
  private apiKey: string | undefined;
  private defaultFromEmail: string;
  private defaultFromName: string;

  constructor() {
    this.apiKey = process.env.POSTMARK_API_KEY;
    this.defaultFromEmail = process.env.POSTMARK_FROM_EMAIL || 'noreply@leadgen.ai';
    this.defaultFromName = process.env.POSTMARK_FROM_NAME || 'AI Lead Generation Platform';

    if (this.apiKey) {
      this.client = new postmark.ServerClient(this.apiKey);
      console.log('✅ Postmark email service initialized');
    } else {
      console.warn('⚠️  POSTMARK_API_KEY not configured - email functionality disabled');
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.client) {
      console.warn('Postmark not configured - email not sent');
      return this.getMockEmailResult(options);
    }

    try {
      const emailData: postmark.Models.Message = {
        From: `${options.fromName || this.defaultFromName} <${options.from || this.defaultFromEmail}>`,
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
          TrackLinks: emailData.TrackLinks,
        };

        const response = await this.client.sendEmailWithTemplate(templateData);
        
        return {
          messageId: response.MessageID,
          status: 'sent',
          to: options.to,
          submittedAt: new Date(response.SubmittedAt),
        };
      } else {
        const response = await this.client.sendEmail(emailData);
        
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
    if (!this.client) {
      console.warn('Postmark not configured - bulk emails not sent');
      const details = emails.map(email => this.getMockEmailResult(email));
      return {
        successful: details.length,
        failed: 0,
        total: emails.length,
        details,
      };
    }

    const results: EmailResult[] = [];
    let successful = 0;
    let failed = 0;

    // Postmark supports batch sending up to 500 emails
    const batchSize = 500;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const emailBatch = batch.map(options => ({
          From: `${options.fromName || this.defaultFromName} <${options.from || this.defaultFromEmail}>`,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.htmlContent,
          TextBody: options.textContent || this.htmlToText(options.htmlContent),
          Tag: options.tag || 'leadgen-campaign',
          TrackOpens: options.trackOpens !== false,
        }));

        const responses = await this.client.sendEmailBatch(emailBatch);
        
        responses.forEach((response, index) => {
          const originalEmail = batch[index];
          if (response.ErrorCode === 0) {
            successful++;
            results.push({
              messageId: response.MessageID,
              status: 'sent',
              to: originalEmail.to,
              submittedAt: new Date(response.SubmittedAt),
            });
          } else {
            failed++;
            results.push({
              messageId: '',
              status: 'failed',
              error: response.Message,
              to: originalEmail.to,
              submittedAt: new Date(),
            });
          }
        });
      } catch (error: any) {
        console.error('Postmark batch email error:', error);
        
        // Mark all emails in this batch as failed
        batch.forEach(email => {
          failed++;
          results.push({
            messageId: '',
            status: 'failed',
            error: error.message,
            to: email.to,
            submittedAt: new Date(),
          });
        });
      }
    }

    return {
      successful,
      failed,
      total: emails.length,
      details: results,
    };
  }

  async getDeliveryStats(messageId: string): Promise<any> {
    if (!this.client) {
      return null;
    }

    try {
      const outboundMessage = await this.client.getOutboundMessageDetails(messageId);
      return {
        messageId,
        status: outboundMessage.Status,
        events: outboundMessage.MessageEvents,
        receivedAt: outboundMessage.ReceivedAt,
        subject: outboundMessage.Subject,
        to: outboundMessage.Recipients,
      };
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      return null;
    }
  }

  async getAccountInfo(): Promise<any> {
    if (!this.client) {
      return null;
    }

    try {
      // Note: Account info endpoint may require specific API permissions
      // For now, return basic service status
      return {
        service: 'Postmark',
        configured: true,
        fromEmail: this.defaultFromEmail,
        fromName: this.defaultFromName,
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      return null;
    }
  }

  private htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private getMockEmailResult(options: EmailOptions): EmailResult {
    return {
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      to: options.to,
      submittedAt: new Date(),
    };
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getConfiguration(): { configured: boolean; fromEmail?: string; fromName?: string } {
    return {
      configured: this.isConfigured(),
      fromEmail: this.defaultFromEmail,
      fromName: this.defaultFromName,
    };
  }
}

export const postmarkService = new PostmarkService();