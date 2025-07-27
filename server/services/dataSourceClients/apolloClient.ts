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
    console.log('🚀 Apollo Client initialized with API key:', apiKey ? 'Present' : 'Missing');
  }

  async search(params: ApolloSearchParams): Promise<{ results: ApolloProspect[], total: number }> {
    if (!this.apiKey || this.apiKey === 'mock') {
      // Return empty results if no valid API key
      console.log('❌ Apollo API key missing or set to mock');
      return { results: [], total: 0 };
    }

    try {
      // Build request payload with proper Apollo API structure
      const payload: any = {
        per_page: Math.min(params.limit || 50, 200), // Apollo max is 200 per page
        page: params.page || 1,
      };

      // Add search criteria - Apollo requires at least one search parameter
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

      // Ensure we have at least one search parameter for Apollo API
      if (!payload.q_keywords && (!payload.person_titles || payload.person_titles.length === 0) && 
          (!payload.organization_industry_tag_names || payload.organization_industry_tag_names.length === 0)) {
        payload.q_keywords = "sales manager"; // Default fallback search
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
          timeout: 30000, // 30 second timeout
        }
      );

      console.log('✅ Apollo API response received:', {
        people_count: response.data.people?.length || 0,
        total_entries: response.data.pagination?.total_entries || 0,
        current_page: response.data.pagination?.page || 0,
        per_page: response.data.pagination?.per_page || 0
      });

      if (!response.data.people || !Array.isArray(response.data.people)) {
        console.error('❌ Apollo API returned invalid data structure:', response.data);
        return { results: [], total: 0 };
      }

      const prospects = response.data.people.map((person: any, index: number) => {
        try {
          return {
            id: person.id || `apollo_${Date.now()}_${index}`,
            first_name: person.first_name || '',
            last_name: person.last_name || '',
            title: person.title || '',
            company: {
              name: person.organization?.name || 'Unknown Company',
              industry: person.organization?.industry || '',
              size: this.formatCompanySize(person.organization?.estimated_num_employees),
              location: this.formatLocation(person.organization),
              technologies: person.organization?.technologies || [],
            },
            email: person.email || '',
            phone: person.phone_numbers?.[0]?.sanitized_number || person.phone_numbers?.[0]?.number,
            linkedin_url: person.linkedin_url || '',
            verified_at: person.email_verified_at,
            confidence_score: this.calculateConfidenceScore(person),
          };
        } catch (mappingError) {
          console.error('Error mapping prospect:', mappingError, person);
          return null;
        }
      }).filter(Boolean); // Remove any null entries from mapping errors

      const totalResults = response.data.pagination?.total_entries || prospects.length;

      console.log(`📊 Apollo search completed: ${prospects.length} prospects mapped, ${totalResults} total available`);

      return {
        results: prospects,
        total: totalResults,
      };
    } catch (error: any) {
      console.error('❌ Apollo API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        }
      });

      // If it's a 422 error, log the specific validation issues
      if (error.response?.status === 422) {
        console.error('💥 Apollo API validation error:', JSON.stringify(error.response.data, null, 2));
      }

      // If it's a 401 error, the API key might be invalid
      if (error.response?.status === 401) {
        console.error('🔑 Apollo API authentication failed - check API key');
      }

      // If it's a 403 error, might be rate limited or quota exceeded
      if (error.response?.status === 403) {
        console.error('🚫 Apollo API access denied - check quota and rate limits');
      }

      return { results: [], total: 0 };
    }
  }

  private formatCompanySize(size: any): string {
    if (typeof size === 'string') return size;
    if (typeof size === 'number') return size.toString();
    return '';
  }

  private formatLocation(organization: any): string {
    if (!organization) return '';
    
    const parts = [];
    if (organization.city) parts.push(organization.city);
    if (organization.state) parts.push(organization.state);
    if (organization.country) parts.push(organization.country);
    
    return parts.join(', ') || organization.location || '';
  }

  private calculateConfidenceScore(person: any): number {
    let score = 0.5; // Base score
    
    // Boost score based on data quality
    if (person.email) score += 0.2;
    if (person.email_verified_at) score += 0.1;
    if (person.phone_numbers && person.phone_numbers.length > 0) score += 0.1;
    if (person.linkedin_url) score += 0.1;
    if (person.organization?.name) score += 0.1;
    
    return Math.min(score, 1.0);
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