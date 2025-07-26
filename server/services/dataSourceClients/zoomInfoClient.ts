import axios from 'axios';

export interface ZoomInfoSearchParams {
  keywords?: string;
  industry?: string;
  location?: string;
  jobTitles?: string[];
  companySize?: string;
  revenue?: string;
  page?: number;
  limit?: number;
}

export interface ZoomInfoProspect {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: {
    name: string;
    industry: string;
    employeeCount: number;
    revenue: string;
    location: string;
  };
  email: string;
  phone?: string;
  linkedInUrl?: string;
  lastUpdated: string;
  accuracy: number;
}

export class ZoomInfoClient {
  private apiKey: string;
  private baseUrl = 'https://api.zoominfo.com/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(params: ZoomInfoSearchParams): Promise<{ results: ZoomInfoProspect[], total: number }> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return { results: [], total: 0 };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/contact`,
        {
          rpp: params.limit || 25,
          page: params.page || 1,
          personalName: params.keywords,
          jobTitle: params.jobTitles,
          companyName: params.keywords,
          industry: params.industry,
          locationCompanyCity: params.location,
          employeeCount: this.mapEmployeeCount(params.companySize),
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const prospects = response.data.data.map((contact: any) => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        jobTitle: contact.jobTitle,
        company: {
          name: contact.company.name,
          industry: contact.company.industry,
          employeeCount: contact.company.employeeCount,
          revenue: contact.company.revenue,
          location: `${contact.company.city}, ${contact.company.state}`,
        },
        email: contact.emailAddress,
        phone: contact.phoneNumber,
        linkedInUrl: contact.linkedInUrl,
        lastUpdated: contact.lastUpdatedDate,
        accuracy: contact.accuracyScore || 0.8,
      }));

      return {
        results: prospects,
        total: response.data.totalResults,
      };
    } catch (error) {
      console.error('ZoomInfo API error:', error);
      return { results: [], total: 0 };
    }
  }

  private mapEmployeeCount(size?: string): string {
    const sizeMap: Record<string, string> = {
      'startup': '1-50',
      'smb': '51-500',
      'midmarket': '501-5000',
      'enterprise': '5000+',
    };
    return size && sizeMap[size] ? sizeMap[size] : '';
  }
}