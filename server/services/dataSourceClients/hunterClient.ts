export interface HunterSearchParams {
  domain?: string;
  company?: string;
  type?: 'personal' | 'generic';
  limit?: number;
  offset?: number;
  department?: string;
  seniority?: string;
}

export interface HunterEmailFinderParams {
  domain: string;
  first_name: string;
  last_name: string;
  full_name?: string;
}

export interface HunterContact {
  value: string; // email
  type: 'personal' | 'generic';
  confidence: number;
  firstName?: string;
  lastName?: string;
  position?: string;
  seniority?: string;
  department?: string;
  linkedIn?: string;
  twitter?: string;
  phoneNumber?: string;
  lastUpdated: string;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
}

export interface HunterDomainSearchResponse {
  success: boolean;
  domain: string;
  organization: string;
  pattern?: string;
  emails: HunterContact[];
  meta: {
    results: number;
    limit: number;
    offset: number;
    params: HunterSearchParams;
  };
  remainingRequests?: number;
  error?: string;
}

export interface HunterEmailVerification {
  email: string;
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  score: number; // 0-100
  regexp: boolean;
  gibberish: boolean;
  disposable: boolean;
  webmail: boolean;
  mx_records: boolean;
  smtp_server: boolean;
  smtp_check: boolean;
  accept_all: boolean;
  block: boolean;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
}

export interface HunterEmailFinderResponse {
  success: boolean;
  email?: string;
  score?: number;
  firstName?: string;
  lastName?: string;
  position?: string;
  company?: string;
  domain?: string;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
  error?: string;
}

export class HunterClient {
  private apiKey: string;
  private baseUrl = 'https://api.hunter.io/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchDomain(params: HunterSearchParams): Promise<HunterDomainSearchResponse> {
    try {
      console.log('🔍 Hunter.io: Searching domain for emails:', params);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));

      const mockEmails = this.generateMockEmails(params);
      
      return {
        success: true,
        domain: params.domain || 'example.com',
        organization: params.company || 'Example Company',
        pattern: '{first}.{last}@{domain}',
        emails: mockEmails,
        meta: {
          results: mockEmails.length,
          limit: params.limit || 25,
          offset: params.offset || 0,
          params
        },
        remainingRequests: 150
      };
    } catch (error) {
      console.error('Hunter.io domain search error:', error);
      return {
        success: false,
        domain: params.domain || '',
        organization: params.company || '',
        emails: [],
        meta: {
          results: 0,
          limit: params.limit || 25,
          offset: params.offset || 0,
          params
        },
        error: error instanceof Error ? error.message : 'Hunter.io API error'
      };
    }
  }

  async findEmail(params: HunterEmailFinderParams): Promise<HunterEmailFinderResponse> {
    try {
      console.log('🔍 Hunter.io: Finding email for:', params);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 1000));

      // Generate likely email based on common patterns
      const emailPatterns = [
        `${params.first_name.toLowerCase()}.${params.last_name.toLowerCase()}@${params.domain}`,
        `${params.first_name.toLowerCase()}${params.last_name.toLowerCase()}@${params.domain}`,
        `${params.first_name.toLowerCase().charAt(0)}${params.last_name.toLowerCase()}@${params.domain}`,
        `${params.first_name.toLowerCase()}@${params.domain}`
      ];

      const email = emailPatterns[0]; // Use most common pattern
      const confidence = Math.floor(Math.random() * 30) + 70; // 70-100% confidence

      return {
        success: true,
        email,
        score: confidence,
        firstName: params.first_name,
        lastName: params.last_name,
        company: params.domain.split('.')[0],
        domain: params.domain,
        sources: [{
          domain: params.domain,
          uri: `https://${params.domain}/team`,
          extracted_on: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        }]
      };
    } catch (error) {
      console.error('Hunter.io email finder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hunter.io API error'
      };
    }
  }

  async verifyEmail(email: string): Promise<HunterEmailVerification> {
    try {
      console.log('🔍 Hunter.io: Verifying email:', email);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      // Basic email validation logic
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidFormat = emailRegex.test(email);
      
      const domain = email.split('@')[1];
      const isWebmail = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain.toLowerCase());
      const isDisposable = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'].includes(domain.toLowerCase());

      let result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
      let score: number;

      if (!isValidFormat) {
        result = 'undeliverable';
        score = 0;
      } else if (isDisposable) {
        result = 'risky';
        score = 25;
      } else if (isWebmail) {
        result = 'deliverable';
        score = Math.floor(Math.random() * 20) + 80; // 80-100%
      } else {
        result = 'deliverable';
        score = Math.floor(Math.random() * 15) + 85; // 85-100%
      }

      return {
        email,
        result,
        score,
        regexp: isValidFormat,
        gibberish: email.length > 50 || /(.)\1{3,}/.test(email),
        disposable: isDisposable,
        webmail: isWebmail,
        mx_records: true,
        smtp_server: true,
        smtp_check: result === 'deliverable',
        accept_all: false,
        block: false,
        sources: [{
          domain,
          uri: `https://${domain}`,
          extracted_on: new Date().toISOString()
        }]
      };
    } catch (error) {
      console.error('Hunter.io email verification error:', error);
      return {
        email,
        result: 'unknown',
        score: 0,
        regexp: false,
        gibberish: false,
        disposable: false,
        webmail: false,
        mx_records: false,
        smtp_server: false,
        smtp_check: false,
        accept_all: false,
        block: false,
        sources: []
      };
    }
  }

  private generateMockEmails(params: HunterSearchParams): HunterContact[] {
    const positions = [
      'CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Director of Engineering',
      'Head of Product', 'Sales Manager', 'Marketing Manager', 'Software Engineer',
      'Product Manager', 'Business Development Manager', 'Operations Manager'
    ];

    const departments = ['Sales', 'Marketing', 'Engineering', 'Product', 'Operations', 'Executive'];
    const seniorities = ['Executive', 'Senior', 'Junior'];

    const firstNames = ['John', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'Alex', 'Maria'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

    const domain = params.domain || 'example.com';
    const limit = Math.min(params.limit || 25, 50);

    return Array.from({ length: limit }, (_, i) => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const position = positions[Math.floor(Math.random() * positions.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      const seniority = seniorities[Math.floor(Math.random() * seniorities.length)];

      // Generate email based on common patterns
      const emailPatterns = [
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
        `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
        `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase()}@${domain}`,
      ];
      const email = emailPatterns[Math.floor(Math.random() * emailPatterns.length)];

      return {
        value: email,
        type: Math.random() > 0.8 ? 'generic' : 'personal' as 'personal' | 'generic',
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
        firstName,
        lastName,
        position,
        seniority,
        department,
        linkedIn: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
        twitter: Math.random() > 0.7 ? `https://twitter.com/${firstName.toLowerCase()}${lastName.toLowerCase()}` : undefined,
        phoneNumber: Math.random() > 0.6 ? `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        lastUpdated: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
        sources: [{
          domain,
          uri: `https://${domain}/team`,
          extracted_on: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        }]
      };
    });
  }

  async getApiStatus(): Promise<{ available: boolean; requests?: number; rateLimit?: any }> {
    try {
      return {
        available: true,
        requests: 150,
        rateLimit: {
          limit: 200,
          remaining: 150,
          reset: Date.now() + 3600000 // 1 hour
        }
      };
    } catch (error) {
      return {
        available: false
      };
    }
  }
}