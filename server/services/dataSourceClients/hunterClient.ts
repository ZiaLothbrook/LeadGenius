import axios from 'axios';

export interface HunterSearchParams {
  domain?: string;
  company?: string;
  name?: string;
  limit?: number;
}

export interface HunterProspect {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  company: string;
  domain: string;
  email: string;
  confidence: number;
  sources: Array<{
    domain: string;
    uri: string;
    last_seen: string;
  }>;
}

export class HunterClient {
  private apiKey: string;
  private baseUrl = 'https://api.hunter.io/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchByDomain(domain: string, limit: number = 10): Promise<{ results: HunterProspect[], total: number }> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return { results: [], total: 0 };
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/domain-search`,
        {
          params: {
            domain,
            api_key: this.apiKey,
            limit,
          },
        }
      );

      const prospects = response.data.data.emails.map((email: any) => ({
        id: `hunter_${email.value}`,
        firstName: email.first_name || '',
        lastName: email.last_name || '',
        position: email.position || '',
        company: response.data.data.organization || domain,
        domain,
        email: email.value,
        confidence: email.confidence / 100,
        sources: email.sources || [],
      }));

      return {
        results: prospects,
        total: response.data.data.emails.length,
      };
    } catch (error) {
      console.error('Hunter API error:', error);
      return { results: [], total: 0 };
    }
  }

  async findEmail(firstName: string, lastName: string, domain: string): Promise<HunterProspect | null> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/email-finder`,
        {
          params: {
            domain,
            first_name: firstName,
            last_name: lastName,
            api_key: this.apiKey,
          },
        }
      );

      if (response.data.data.email) {
        return {
          id: `hunter_${response.data.data.email}`,
          firstName,
          lastName,
          position: response.data.data.position || '',
          company: response.data.data.company || domain,
          domain,
          email: response.data.data.email,
          confidence: response.data.data.confidence / 100,
          sources: response.data.data.sources || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Hunter API error:', error);
      return null;
    }
  }

  async search(params: HunterSearchParams): Promise<{ results: HunterProspect[], total: number }> {
    if (params.domain) {
      return this.searchByDomain(params.domain, params.limit);
    }
    
    if (params.name && params.company) {
      const [firstName, ...lastNameParts] = params.name.split(' ');
      const lastName = lastNameParts.join(' ');
      const result = await this.findEmail(firstName, lastName, params.company);
      return result ? { results: [result], total: 1 } : { results: [], total: 0 };
    }

    return { results: [], total: 0 };
  }
}