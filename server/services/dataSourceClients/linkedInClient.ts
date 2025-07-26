import axios from 'axios';

export interface LinkedInSearchParams {
  keywords?: string;
  title?: string;
  company?: string;
  location?: string;
  industry?: string;
  limit?: number;
  page?: number;
}

export interface LinkedInProspect {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  title: string;
  company: string;
  location: string;
  profileUrl: string;
  summary?: string;
  connectionDegree?: number;
}

export class LinkedInClient {
  private apiKey: string;
  private baseUrl = 'https://api.linkedin.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(params: LinkedInSearchParams): Promise<{ results: LinkedInProspect[], total: number }> {
    if (!this.apiKey || this.apiKey === 'mock') {
      // LinkedIn Sales Navigator API requires enterprise access
      // Return empty results for now
      return { results: [], total: 0 };
    }

    try {
      // Note: LinkedIn's API is very restricted
      // This is a simplified example - actual implementation would require OAuth flow
      // and Sales Navigator API access
      const response = await axios.get(
        `${this.baseUrl}/people-search`,
        {
          params: {
            keywords: params.keywords,
            title: params.title,
            company: params.company,
            location: params.location,
            industry: params.industry,
            count: params.limit || 25,
            start: ((params.page || 1) - 1) * (params.limit || 25),
          },
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'X-RestLi-Protocol-Version': '2.0.0',
          },
        }
      );

      const prospects = response.data.elements.map((person: any) => ({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        headline: person.headline,
        title: person.position?.title || '',
        company: person.position?.companyName || '',
        location: person.location?.name || '',
        profileUrl: `https://www.linkedin.com/in/${person.publicIdentifier}`,
        summary: person.summary,
        connectionDegree: person.distance,
      }));

      return {
        results: prospects,
        total: response.data.paging?.total || prospects.length,
      };
    } catch (error) {
      console.error('LinkedIn API error:', error);
      return { results: [], total: 0 };
    }
  }

  async getProfile(profileId: string): Promise<LinkedInProspect | null> {
    if (!this.apiKey || this.apiKey === 'mock') {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/people/${profileId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'X-RestLi-Protocol-Version': '2.0.0',
          },
        }
      );

      const person = response.data;
      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        headline: person.headline,
        title: person.position?.title || '',
        company: person.position?.companyName || '',
        location: person.location?.name || '',
        profileUrl: `https://www.linkedin.com/in/${person.publicIdentifier}`,
        summary: person.summary,
      };
    } catch (error) {
      console.error('LinkedIn API error:', error);
      return null;
    }
  }
}