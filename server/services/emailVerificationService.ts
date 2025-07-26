import axios from 'axios';

interface EmailValidationResult {
  email: string;
  status: 'valid' | 'invalid' | 'catch-all' | 'spamtrap' | 'abuse' | 'do_not_mail' | 'unknown';
  sub_status: string;
  free_email: boolean;
  did_you_mean: string | null;
  account: string;
  domain: string;
  domain_age_days: string;
  smtp_provider: string;
  mx_found: boolean;
  mx_record: string;
  firstname: string;
  lastname: string;
  gender: string;
  country: string;
  region: string;
  city: string;
  zipcode: string;
  processed_at: string;
}

class EmailVerificationService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.zerobounce.net/v2';

  constructor() {
    this.apiKey = process.env.ZEROBOUNCE_API_KEY;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    if (!this.apiKey) {
      console.warn('ZeroBounce API key not configured - returning mock validation');
      return this.getMockValidation(email);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/validate`, {
        params: {
          email,
          api_key: this.apiKey,
          ip_address: '' // Optional IP for better accuracy
        }
      });

      return response.data;
    } catch (error) {
      console.error('ZeroBounce validation error:', error);
      return this.getMockValidation(email);
    }
  }

  async validateBatch(emails: string[]): Promise<{ email: string; result: EmailValidationResult }[]> {
    if (!this.apiKey) {
      console.warn('ZeroBounce API key not configured - returning mock validations');
      return emails.map(email => ({
        email,
        result: this.getMockValidation(email)
      }));
    }

    try {
      // ZeroBounce batch API requires a different endpoint and format
      const response = await axios.post(`${this.baseUrl}/validatebatch`, {
        api_key: this.apiKey,
        email_batch: emails.map(email => ({ email_address: email }))
      });

      return response.data.email_batch.map((item: any, index: number) => ({
        email: emails[index],
        result: item
      }));
    } catch (error) {
      console.error('ZeroBounce batch validation error:', error);
      return emails.map(email => ({
        email,
        result: this.getMockValidation(email)
      }));
    }
  }

  async getCredits(): Promise<number> {
    if (!this.apiKey) {
      return 0;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getcredits`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data.Credits || 0;
    } catch (error) {
      console.error('ZeroBounce get credits error:', error);
      return 0;
    }
  }

  private getMockValidation(email: string): EmailValidationResult {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);
    
    const [account, domain] = email.split('@');
    const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    
    return {
      email,
      status: isValidFormat ? 'valid' : 'invalid',
      sub_status: isValidFormat ? 'role_based_catch_all' : 'mailbox_not_found',
      free_email: freeEmailDomains.includes(domain),
      did_you_mean: null,
      account,
      domain,
      domain_age_days: '1000',
      smtp_provider: domain,
      mx_found: true,
      mx_record: `mail.${domain}`,
      firstname: '',
      lastname: '',
      gender: '',
      country: '',
      region: '',
      city: '',
      zipcode: '',
      processed_at: new Date().toISOString()
    };
  }

  isDeliverable(result: EmailValidationResult): boolean {
    return ['valid', 'catch-all'].includes(result.status);
  }

  getRiskLevel(result: EmailValidationResult): 'low' | 'medium' | 'high' {
    if (result.status === 'valid' && !result.free_email) {
      return 'low';
    } else if (result.status === 'valid' || result.status === 'catch-all') {
      return 'medium';
    }
    return 'high';
  }
}

export const emailVerificationService = new EmailVerificationService();