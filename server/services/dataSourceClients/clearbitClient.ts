import axios from 'axios';

export interface ClearbitSearchParams {
  domain?: string;
  email?: string;
  company?: string;
  role?: string;
  limit?: number;
}

export interface ClearbitProspect {
  id: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  title: string;
  company: {
    name: string;
    domain: string;
    industry: string;
    employees: string;
    location: string;
    description: string;
    tags: string[];
    tech: string[];
  };
  email: string;
  phone?: string;
  linkedin?: string;
  avatar?: string;
}

export class ClearbitClient {
  private apiKey: string;
  private baseUrl = 'https://company.clearbit.com/v2';
  private personUrl = 'https://person.clearbit.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async enrichCompany(domain: string): Promise<any> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/companies/find`,
        {
          params: { domain },
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Clearbit Company API error:', error);
      return null;
    }
  }

  async enrichPerson(email: string): Promise<ClearbitProspect | null> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.personUrl}/people/email/${email}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const person = response.data;
      const company = person.company || {};

      return {
        id: person.id || email,
        name: {
          fullName: person.name?.fullName || '',
          givenName: person.name?.givenName || '',
          familyName: person.name?.familyName || '',
        },
        title: person.employment?.title || '',
        company: {
          name: company.name || '',
          domain: company.domain || '',
          industry: company.industry || '',
          employees: company.metrics?.employees || '',
          location: company.geo?.city ? `${company.geo.city}, ${company.geo.stateCode}` : '',
          description: company.description || '',
          tags: company.tags || [],
          tech: company.tech || [],
        },
        email: person.email,
        phone: person.phone,
        linkedin: person.linkedin?.handle,
        avatar: person.avatar,
      };
    } catch (error) {
      console.error('Clearbit Person API error:', error);
      return null;
    }
  }

  async search(params: ClearbitSearchParams): Promise<{ results: ClearbitProspect[], total: number }> {
    if (params.email) {
      const result = await this.enrichPerson(params.email);
      return result ? { results: [result], total: 1 } : { results: [], total: 0 };
    }

    if (params.domain) {
      const company = await this.enrichCompany(params.domain);
      if (company) {
        // Create a basic prospect from company data
        const prospect: ClearbitProspect = {
          id: `clearbit_company_${company.id}`,
          name: {
            fullName: '',
            givenName: '',
            familyName: '',
          },
          title: '',
          company: {
            name: company.name,
            domain: company.domain,
            industry: company.category?.industry || '',
            employees: company.metrics?.employees || '',
            location: company.geo?.city ? `${company.geo.city}, ${company.geo.stateCode}` : '',
            description: company.description || '',
            tags: company.tags || [],
            tech: company.tech || [],
          },
          email: '',
        };
        return { results: [prospect], total: 1 };
      }
    }

    return { results: [], total: 0 };
  }
}