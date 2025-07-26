import axios from 'axios';

export interface ApolloSearchParams {
  keywords?: string;
  industry?: string;
  location?: string;
  jobTitles?: string[];
  companySize?: string;
  technologies?: string[];
  page?: number;
  limit?: number;
}

export interface ApolloProspect {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  company: {
    name: string;
    industry: string;
    size: string;
    location: string;
    technologies?: string[];
  };
  email: string;
  phone?: string;
  linkedin_url?: string;
  verified_at?: string;
  confidence_score: number;
}

export class ApolloClient {
  private apiKey: string;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(params: ApolloSearchParams): Promise<{ results: ApolloProspect[], total: number }> {
    if (!this.apiKey || this.apiKey === 'mock') {
      // Return empty results if no valid API key
      return { results: [], total: 0 };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/mixed_people/search`,
        {
          per_page: params.limit || 25,
          page: params.page || 1,
          person_titles: params.jobTitles || [],
          organization_industry_tag_names: params.industry ? [params.industry] : [],
          organization_locations: params.location ? [params.location] : [],
          q_keywords: params.keywords || '',
          organization_num_employees_ranges: this.mapCompanySize(params.companySize),
          technologies: params.technologies || [],
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const prospects = response.data.people.map((person: any) => ({
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        title: person.title,
        company: {
          name: person.organization?.name || '',
          industry: person.organization?.industry || '',
          size: person.organization?.estimated_num_employees || '',
          location: person.organization?.location || '',
          technologies: person.organization?.technologies || [],
        },
        email: person.email,
        phone: person.phone_numbers?.[0]?.number,
        linkedin_url: person.linkedin_url,
        verified_at: person.email_verified_at,
        confidence_score: person.email_confidence || 0.5,
      }));

      return {
        results: prospects,
        total: response.data.pagination.total_entries,
      };
    } catch (error) {
      console.error('Apollo API error:', error);
      return { results: [], total: 0 };
    }
  }

  private mapCompanySize(size?: string): string[] {
    const sizeMap: Record<string, string[]> = {
      'startup': ['1-10', '11-50'],
      'smb': ['51-200', '201-500'],
      'midmarket': ['501-1000', '1001-5000'],
      'enterprise': ['5001-10000', '10001+'],
    };
    return size && sizeMap[size] ? sizeMap[size] : [];
  }
}