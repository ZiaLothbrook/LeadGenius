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
      // Build request payload
      const payload: any = {
        per_page: params.limit || 25,
        page: params.page || 1,
      };
      
      // Only add fields that have values to avoid validation errors
      if (params.keywords) {
        payload.q_keywords = params.keywords;
      }
      
      if (params.jobTitles && params.jobTitles.length > 0) {
        payload.person_titles = params.jobTitles;
      }
      
      if (params.industry) {
        payload.organization_industry_tag_names = [params.industry];
      }
      
      if (params.location) {
        payload.organization_locations = [params.location];
      }
      
      const companySizes = this.mapCompanySize(params.companySize);
      if (companySizes.length > 0) {
        payload.organization_num_employees_ranges = companySizes;
      }
      
      if (params.technologies && params.technologies.length > 0) {
        payload.technologies = params.technologies;
      }
      
      console.log('🚀 Apollo API request payload:', JSON.stringify(payload, null, 2));
      
      const response = await axios.post(
        `${this.baseUrl}/mixed_people/search`,
        payload,
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
    } catch (error: any) {
      console.error('Apollo API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // If it's a 422 error, log the specific validation issues
      if (error.response?.status === 422) {
        console.error('Apollo API validation error:', JSON.stringify(error.response.data, null, 2));
      }
      
      return { results: [], total: 0 };
    }
  }

  private mapCompanySize(size?: string): string[] {
    // Direct mapping for frontend values
    const directMap: Record<string, string[]> = {
      '1-10': ['1-10'],
      '11-50': ['11-50'],
      '51-200': ['51-200'],
      '200+': ['201-500', '501-1000', '1001-5000', '5001-10000', '10001+'],
      'all': [],
    };
    
    // Legacy mapping for backward compatibility
    const sizeMap: Record<string, string[]> = {
      'startup': ['1-10', '11-50'],
      'smb': ['51-200', '201-500'],
      'midmarket': ['501-1000', '1001-5000'],
      'enterprise': ['5001-10000', '10001+'],
    };
    
    return directMap[size || ''] || sizeMap[size || ''] || [];
  }
}