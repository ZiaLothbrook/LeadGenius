import { ApolloClient } from './dataSourceClients/apolloClient';
import { ZoomInfoClient } from './dataSourceClients/zoomInfoClient';
import { HunterClient } from './dataSourceClients/hunterClient';
import { ClearbitClient } from './dataSourceClients/clearbitClient';
import { LinkedInClient } from './dataSourceClients/linkedInClient';
import { aiService } from './aiService';
import crypto from 'crypto';
import { db } from '../db';
import { prospectSearches, discoveredProspects } from '@shared/schema';

export interface SearchCriteria {
  keywords?: string;
  industry?: string;
  location?: string;
  jobTitles?: string[];
  companySize?: string;
  technologies?: string[];
  domain?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export interface UnifiedProspect {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  dataQuality: number;
  sources: string[];
  enrichmentData?: {
    technologies?: string[];
    companySize?: string;
    revenue?: string;
    funding?: string;
    lastActivity?: string;
  };
  aiScore?: number;
  intentSignals?: string[];
}

export class ProspectDiscoveryService {
  private dataSources: {
    apollo?: ApolloClient;
    zoominfo?: ZoomInfoClient;
    hunter?: HunterClient;
    clearbit?: ClearbitClient;
    linkedin?: LinkedInClient;
  };
  
  constructor() {
    // Initialize data sources only if API keys are available
    this.dataSources = {
      apollo: process.env.APOLLO_API_KEY ? new ApolloClient(process.env.APOLLO_API_KEY) : undefined,
      zoominfo: process.env.ZOOMINFO_API_KEY ? new ZoomInfoClient(process.env.ZOOMINFO_API_KEY) : undefined,
      hunter: process.env.HUNTER_API_KEY ? new HunterClient(process.env.HUNTER_API_KEY) : undefined,
      clearbit: process.env.CLEARBIT_API_KEY ? new ClearbitClient(process.env.CLEARBIT_API_KEY) : undefined,
      linkedin: process.env.LINKEDIN_API_KEY ? new LinkedInClient(process.env.LINKEDIN_API_KEY) : undefined,
    };

    console.log('🔍 Prospect Discovery Service initialized with sources:', 
      Object.entries(this.dataSources)
        .filter(([_, client]) => client !== undefined)
        .map(([name]) => name)
    );
  }

  async searchProspects(searchCriteria: SearchCriteria, userId?: string): Promise<{
    success: boolean;
    totalResults: number;
    prospects: UnifiedProspect[];
    searchInsights: {
      dataSourcesUsed: number;
      averageConfidence: number;
      topIndustries: string[];
      missingApiKeys?: string[];
    };
    pagination: {
      page: number;
      limit: number;
      hasMore: boolean;
    };
  }> {
    try {
      // Track which API keys are missing
      const missingApiKeys = this.getMissingApiKeys();

      // Execute parallel searches across available data sources
      const searchPromises = Object.entries(this.dataSources)
        .filter(([_, client]) => client !== undefined)
        .map(async ([source, client]) => {
          try {
            console.log(`🔍 Starting search with ${source}...`);
            const results = await this.searchBySource(source, client!, searchCriteria);
            console.log(`✅ ${source} search completed:`, {
              results_count: results.results?.length || 0,
              total: results.total || 0
            });
            return { source, results, error: null };
          } catch (error) {
            console.error(`❌ Error searching ${source}:`, error);
            return { source, results: { results: [], total: 0 }, error };
          }
        });

      const rawResults = await Promise.all(searchPromises);
      
      // Extract all prospects from results
      const allProspects: UnifiedProspect[] = [];
      let totalFromAllSources = 0;
      
      rawResults.forEach(({ source, results, error }) => {
        const count = results.results?.length || 0;
        const total = results.total || 0;
        totalFromAllSources += total;
        
        console.log(`📊 ${source} returned ${count} prospects (${total} total available)${error ? ' with errors' : ''}`);
        
        if (results.results && Array.isArray(results.results)) {
          results.results.forEach((prospect: any) => {
            try {
              const normalizedProspect = this.normalizeProspect(prospect, source);
              allProspects.push(normalizedProspect);
            } catch (normalizationError) {
              console.error(`Error normalizing prospect from ${source}:`, normalizationError);
            }
          });
        }
      });

      console.log(`🔍 Total prospects before deduplication: ${allProspects.length}`);

      // Deduplicate prospects
      const deduplicatedProspects = this.deduplicateProspects(allProspects);
      console.log(`🔍 Total prospects after deduplication: ${deduplicatedProspects.length}`);
      
      // Apply AI scoring and ranking
      const scoredProspects = await this.scoreProspects(deduplicatedProspects, searchCriteria);
      
      // Apply advanced filtering
      const filteredProspects = this.applyAdvancedFilters(scoredProspects, searchCriteria);
      
      // Sort by AI score
      filteredProspects.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
      
      // Paginate results
      const page = searchCriteria.page || 1;
      const limit = searchCriteria.limit || 50;
      const startIndex = (page - 1) * limit;
      const paginatedProspects = filteredProspects.slice(startIndex, startIndex + limit);

      // Save search history and discovered prospects if userId is provided
      if (userId && paginatedProspects.length > 0) {
        try {
          // Save search history
          const [searchRecord] = await db.insert(prospectSearches).values({
            userId,
            searchQuery: searchCriteria as any,
            resultsCount: filteredProspects.length,
            aiInsights: {
              dataSourcesUsed: Object.values(this.dataSources).filter(client => client !== undefined).length,
              averageConfidence: this.calculateAverageConfidence(paginatedProspects),
              topIndustries: this.extractTopIndustries(paginatedProspects),
            }
          }).returning();

          // Save discovered prospects
          if (searchRecord) {
            const prospectsToSave = paginatedProspects.map(prospect => ({
              searchId: searchRecord.id,
              name: prospect.name,
              email: prospect.email || null,
              company: prospect.company || null,
              title: prospect.title || null,
              industry: prospect.industry || null,
              location: prospect.location || null,
              phone: prospect.phone || null,
              linkedinUrl: prospect.linkedinUrl || null,
              aiScore: prospect.aiScore ? Math.min(999.99, prospect.aiScore).toFixed(2) : null,
              confidenceScore: Math.min(999.99, prospect.dataQuality * 100).toFixed(2),
              dataSources: prospect.sources,
              intentSignals: prospect.intentSignals ? prospect.intentSignals as any : null,
            }));

            await db.insert(discoveredProspects).values(prospectsToSave);
          }
        } catch (error) {
          console.error('Error saving search history:', error);
          // Continue even if saving fails
        }
      }

      return {
        success: true,
        totalResults: filteredProspects.length,
        prospects: paginatedProspects,
        searchInsights: {
          dataSourcesUsed: Object.values(this.dataSources).filter(client => client !== undefined).length,
          averageConfidence: this.calculateAverageConfidence(paginatedProspects),
          topIndustries: this.extractTopIndustries(paginatedProspects),
          missingApiKeys: missingApiKeys.length > 0 ? missingApiKeys : undefined,
        },
        pagination: {
          page,
          limit,
          hasMore: filteredProspects.length > startIndex + limit,
        },
      };
    } catch (error) {
      console.error('Prospect search failed:', error);
      return {
        success: false,
        totalResults: 0,
        prospects: [],
        searchInsights: {
          dataSourcesUsed: 0,
          averageConfidence: 0,
          topIndustries: [],
          missingApiKeys: this.getMissingApiKeys(),
        },
        pagination: {
          page: searchCriteria.page || 1,
          limit: searchCriteria.limit || 50,
          hasMore: false,
        },
      };
    }
  }

  private getMissingApiKeys(): string[] {
    const missing: string[] = [];
    if (!process.env.APOLLO_API_KEY) missing.push('APOLLO_API_KEY');
    if (!process.env.ZOOMINFO_API_KEY) missing.push('ZOOMINFO_API_KEY');
    if (!process.env.HUNTER_API_KEY) missing.push('HUNTER_API_KEY');
    if (!process.env.CLEARBIT_API_KEY) missing.push('CLEARBIT_API_KEY');
    if (!process.env.LINKEDIN_API_KEY) missing.push('LINKEDIN_API_KEY');
    return missing;
  }

  private async searchBySource(source: string, client: any, criteria: SearchCriteria): Promise<any> {
    switch (source) {
      case 'apollo':
        console.log(`🔍 Apollo search with criteria:`, {
          keywords: criteria.keywords,
          industry: criteria.industry,
          location: criteria.location,
          jobTitles: criteria.jobTitles,
          companySize: criteria.companySize,
          technologies: criteria.technologies,
          page: criteria.page || 1,
          limit: criteria.limit || 50,
        });
        
        const apolloResult = await (client as ApolloClient).search({
          keywords: criteria.keywords,
          industry: criteria.industry,
          location: criteria.location,
          jobTitles: criteria.jobTitles,
          companySize: criteria.companySize,
          technologies: criteria.technologies,
          page: criteria.page || 1,
          limit: criteria.limit || 50,
        });
        
        console.log(`✅ Apollo returned:`, {
          results_count: apolloResult.results?.length || 0,
          total_available: apolloResult.total || 0
        });
        
        return apolloResult;
      
      case 'zoominfo':
        return await (client as ZoomInfoClient).search({
          keywords: criteria.keywords,
          industry: criteria.industry,
          location: criteria.location,
          jobTitles: criteria.jobTitles,
          companySize: criteria.companySize,
          page: criteria.page,
          limit: criteria.limit,
        });
      
      case 'hunter':
        return await (client as HunterClient).search({
          domain: criteria.domain,
          company: criteria.keywords,
          limit: criteria.limit,
        });
      
      case 'clearbit':
        return await (client as ClearbitClient).search({
          domain: criteria.domain,
          email: criteria.email,
          company: criteria.keywords,
          limit: criteria.limit,
        });
      
      case 'linkedin':
        return await (client as LinkedInClient).search({
          keywords: criteria.keywords,
          title: criteria.jobTitles?.[0],
          location: criteria.location,
          industry: criteria.industry,
          limit: criteria.limit,
          page: criteria.page,
        });
      
      default:
        return { results: [], total: 0 };
    }
  }

  private normalizeProspect(prospect: any, source: string): UnifiedProspect {
    let normalized: UnifiedProspect = {
      id: '',
      name: '',
      title: '',
      company: '',
      industry: '',
      location: '',
      email: '',
      dataQuality: 0,
      sources: [source],
    };

    try {
      switch (source) {
        case 'apollo':
        normalized = {
          id: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`.trim(),
          title: prospect.title || '',
          company: prospect.company?.name || '',
          industry: prospect.company?.industry || '',
          location: prospect.company?.location || '',
          email: prospect.email || '',
          phone: prospect.phone,
          linkedinUrl: prospect.linkedin_url,
          dataQuality: prospect.confidence_score || 0.5,
          sources: [source],
          enrichmentData: {
            technologies: prospect.company?.technologies,
            companySize: prospect.company?.size,
          },
        };
        break;

      case 'zoominfo':
        normalized = {
          id: prospect.id,
          name: `${prospect.firstName} ${prospect.lastName}`.trim(),
          title: prospect.jobTitle || '',
          company: prospect.company?.name || '',
          industry: prospect.company?.industry || '',
          location: prospect.company?.location || '',
          email: prospect.email || '',
          phone: prospect.phone,
          linkedinUrl: prospect.linkedInUrl,
          dataQuality: prospect.accuracy || 0.8,
          sources: [source],
          enrichmentData: {
            companySize: prospect.company?.employeeCount?.toString(),
            revenue: prospect.company?.revenue,
          },
        };
        break;

      case 'hunter':
        normalized = {
          id: prospect.id,
          name: `${prospect.firstName} ${prospect.lastName}`.trim(),
          title: prospect.position || '',
          company: prospect.company || '',
          industry: '',
          location: '',
          email: prospect.email || '',
          dataQuality: prospect.confidence || 0.5,
          sources: [source],
        };
        break;

      case 'clearbit':
        normalized = {
          id: prospect.id,
          name: prospect.name?.fullName || '',
          title: prospect.title || '',
          company: prospect.company?.name || '',
          industry: prospect.company?.industry || '',
          location: prospect.company?.location || '',
          email: prospect.email || '',
          phone: prospect.phone,
          linkedinUrl: prospect.linkedin,
          dataQuality: 0.9, // Clearbit generally has high quality data
          sources: [source],
          enrichmentData: {
            technologies: prospect.company?.tech,
            companySize: prospect.company?.employees,
          },
        };
        break;

      case 'linkedin':
        normalized = {
          id: prospect.id,
          name: `${prospect.firstName} ${prospect.lastName}`.trim(),
          title: prospect.title || prospect.headline || '',
          company: prospect.company || '',
          industry: '',
          location: prospect.location || '',
          email: '', // LinkedIn doesn't provide emails
          linkedinUrl: prospect.profileUrl,
          dataQuality: 0.95, // LinkedIn data is usually very accurate
          sources: [source],
        };
        break;
      }
    } catch (error) {
      console.error(`❌ Error normalizing prospect from ${source}:`, error);
      console.error('Raw prospect data:', prospect);
      // Return a basic normalized prospect with available data
      normalized.id = prospect.id || `${source}_${Date.now()}_${Math.random()}`;
      normalized.name = prospect.name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown';
    }

    return normalized;
  }

  private deduplicateProspects(prospects: UnifiedProspect[]): UnifiedProspect[] {
    const uniqueProspects = new Map<string, UnifiedProspect>();

    prospects.forEach(prospect => {
      // Create a unique key based on email or name + company
      const key = prospect.email || `${prospect.name}-${prospect.company}`.toLowerCase();
      
      if (uniqueProspects.has(key)) {
        // Merge data from multiple sources
        const existing = uniqueProspects.get(key)!;
        existing.sources = [...new Set([...existing.sources, ...prospect.sources])];
        existing.dataQuality = Math.max(existing.dataQuality, prospect.dataQuality);
        
        // Merge enrichment data
        if (prospect.enrichmentData) {
          existing.enrichmentData = {
            ...existing.enrichmentData,
            ...prospect.enrichmentData,
          };
        }
        
        // Fill in missing fields
        if (!existing.phone && prospect.phone) existing.phone = prospect.phone;
        if (!existing.linkedinUrl && prospect.linkedinUrl) existing.linkedinUrl = prospect.linkedinUrl;
        if (!existing.industry && prospect.industry) existing.industry = prospect.industry;
      } else {
        uniqueProspects.set(key, { ...prospect });
      }
    });

    return Array.from(uniqueProspects.values());
  }

  private async scoreProspects(prospects: UnifiedProspect[], criteria: SearchCriteria): Promise<UnifiedProspect[]> {
    // Use AI to score prospects based on fit and intent signals
    const scoringPromises = prospects.map(async (prospect) => {
      try {
        const aiAnalysis = await aiService.analyzeProspectFit({
          prospect,
          searchCriteria: criteria,
          dataPoints: {
            hasEmail: !!prospect.email,
            hasPhone: !!prospect.phone,
            hasLinkedIn: !!prospect.linkedinUrl,
            dataSourceCount: prospect.sources.length,
            hasTechnologies: !!(prospect.enrichmentData?.technologies?.length),
          },
        });

        return {
          ...prospect,
          aiScore: aiAnalysis.fitScore,
          intentSignals: aiAnalysis.intentSignals,
        };
      } catch (error) {
        console.error('Error scoring prospect:', error);
        return {
          ...prospect,
          aiScore: prospect.dataQuality * 50, // Fallback to data quality score
          intentSignals: [],
        };
      }
    });

    return Promise.all(scoringPromises);
  }

  private applyAdvancedFilters(prospects: UnifiedProspect[], criteria: SearchCriteria): UnifiedProspect[] {
    return prospects.filter(prospect => {
      // Filter by minimum data quality
      if (prospect.dataQuality < 0.3) return false;
      
      // Filter by AI score if available
      if (prospect.aiScore && prospect.aiScore < 30) return false;
      
      // Must have either email or LinkedIn
      if (!prospect.email && !prospect.linkedinUrl) return false;
      
      return true;
    });
  }

  private calculateAverageConfidence(prospects: UnifiedProspect[]): number {
    if (prospects.length === 0) return 0;
    const totalConfidence = prospects.reduce((sum, p) => sum + (p.dataQuality || 0), 0);
    return Math.round((totalConfidence / prospects.length) * 100);
  }

  private extractTopIndustries(prospects: UnifiedProspect[]): string[] {
    const industryCounts = new Map<string, number>();
    
    prospects.forEach(prospect => {
      if (prospect.industry) {
        industryCounts.set(prospect.industry, (industryCounts.get(prospect.industry) || 0) + 1);
      }
    });

    return Array.from(industryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([industry]) => industry);
  }
}

export const prospectDiscoveryService = new ProspectDiscoveryService();