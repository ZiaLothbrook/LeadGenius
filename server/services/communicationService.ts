import twilio from 'twilio';

interface SMSOptions {
  to: string;
  body: string;
  mediaUrl?: string;
}

interface CallOptions {
  to: string;
  url: string; // TwiML URL for call instructions
}

interface SMSResult {
  sid: string;
  status: string;
  to: string;
  from: string;
  dateCreated: Date;
  price?: string;
  priceUnit?: string;
}

interface CallResult {
  sid: string;
  status: string;
  to: string;
  from: string;
  duration?: string;
  price?: string;
  priceUnit?: string;
}

class CommunicationService {
  private client: twilio.Twilio | null = null;
  private phoneNumber: string | undefined;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      console.log('✅ Twilio communication service initialized');
    } else {
      console.warn('⚠️  Twilio credentials not configured');
    }
  }

  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    if (!this.client || !this.phoneNumber) {
      console.warn('Twilio not configured - SMS not sent');
      return this.getMockSMSResult(options);
    }

    try {
      const message = await this.client.messages.create({
        body: options.body,
        from: this.phoneNumber,
        to: options.to,
        ...(options.mediaUrl && { mediaUrl: [options.mediaUrl] })
      });

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from || this.phoneNumber,
        dateCreated: message.dateCreated,
        price: message.price,
        priceUnit: message.priceUnit
      };
    } catch (error: any) {
      console.error('Twilio SMS error:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async sendBulkSMS(recipients: string[], body: string): Promise<SMSResult[]> {
    const results: SMSResult[] = [];
    
    // Send SMS in parallel with rate limiting
    const batchSize = 10; // Twilio recommends not exceeding 100 messages per second
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(to => this.sendSMS({ to, body }).catch((error: any) => ({
          sid: 'error',
          status: 'failed',
          to,
          from: this.phoneNumber || '',
          dateCreated: new Date(),
          error: error.message
        })))
      );
      results.push(...batchResults);
      
      // Rate limiting delay
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async makeCall(options: CallOptions): Promise<CallResult> {
    if (!this.client || !this.phoneNumber) {
      console.warn('Twilio not configured - Call not made');
      return this.getMockCallResult(options);
    }

    try {
      const call = await this.client.calls.create({
        url: options.url,
        to: options.to,
        from: this.phoneNumber
      });

      return {
        sid: call.sid,
        status: call.status,
        to: call.to,
        from: call.from || this.phoneNumber,
        duration: call.duration,
        price: call.price,
        priceUnit: call.priceUnit
      };
    } catch (error: any) {
      console.error('Twilio call error:', error);
      throw new Error(`Failed to make call: ${error.message}`);
    }
  }

  async getMessageStatus(messageSid: string): Promise<string> {
    if (!this.client) {
      return 'unknown';
    }

    try {
      const message = await this.client.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      console.error('Failed to get message status:', error);
      return 'error';
    }
  }

  async getCallStatus(callSid: string): Promise<string> {
    if (!this.client) {
      return 'unknown';
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      return call.status;
    } catch (error) {
      console.error('Failed to get call status:', error);
      return 'error';
    }
  }

  // Helper method to format phone numbers for Twilio
  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming US)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // Return as-is if already has country code
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  }

  private getMockSMSResult(options: SMSOptions): SMSResult {
    return {
      sid: `mock_${Date.now()}`,
      status: 'sent',
      to: options.to,
      from: this.phoneNumber || '+1234567890',
      dateCreated: new Date(),
      price: '0.0075',
      priceUnit: 'USD'
    };
  }

  private getMockCallResult(options: CallOptions): CallResult {
    return {
      sid: `mock_call_${Date.now()}`,
      status: 'queued',
      to: options.to,
      from: this.phoneNumber || '+1234567890',
      duration: '0',
      price: '0.02',
      priceUnit: 'USD'
    };
  }

  isConfigured(): boolean {
    return !!this.client && !!this.phoneNumber;
  }

  getPhoneNumber(): string | undefined {
    return this.phoneNumber;
  }
}

export const communicationService = new CommunicationService();