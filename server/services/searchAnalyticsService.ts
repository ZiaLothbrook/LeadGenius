import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq, desc, gte, lte, and, sql, count, avg, sum } from "drizzle-orm";
import {
  searchQueries,
  searchResults,
  searchSessions,
  searchOptimizations,
  searchInsights,
  type InsertSearchQuery,
  type InsertSearchResult,
  type InsertSearchSession,
  type InsertSearchOptimization,
  type InsertSearchInsight,
  type SearchQuery,
  type SearchResult,
  type SearchSession,
  type SearchOptimization,
  type SearchInsight,
} from "@shared/schema";
import { cacheService } from "./cacheService";

// Search analytics configuration
const ANALYTICS_CONFIG = {
  QUALITY_THRESHOLDS: {
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40,
  },
  OPTIMIZATION_THRESHOLDS: {
    MIN_IMPROVEMENT: 10, // Minimum expected improvement to suggest optimization
    AUTO_APPLY_THRESHOLD: 95, // Auto-apply optimizations with 95%+ confidence
  },
  INSIGHT_RETENTION_DAYS: 30,
  SESSION_TIMEOUT_MINUTES: 30,
};

// Validation schemas
export const searchAnalyticsFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  searchSource: z.enum(["web", "api", "mobile"]).optional(),
  searchIntent: z.enum(["discovery", "qualification", "research"]).optional(),
  minQualityScore: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

export const trackSearchQuerySchema = z.object({
  query: z.string().min(1),
  filters: z.record(z.any()).optional(),
  executionTime: z.number().positive(),
  resultsCount: z.number().min(0),
  searchSource: z.enum(["web", "api", "mobile"]).default("web"),
  sessionId: z.string().optional(),
  searchIntent: z.enum(["discovery", "qualification", "research"]).optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const trackSearchResultSchema = z.object({
  queryId: z.string(),
  prospectId: z.string().optional(),
  position: z.number().positive(),
  relevanceScore: z.number().min(0).max(100),
  qualityScore: z.number().min(0).max(100),
  dataCompletenessScore: z.number().min(0).max(100),
  resultSource: z.enum(["apollo", "zoominfo", "hunter", "mock"]),
  resultMetadata: z.record(z.any()).optional(),
});

export const recordResultClickSchema = z.object({
  resultId: z.string(),
  timeToClick: z.number().positive(),
  conversionAction: z.enum(["contacted", "saved", "campaign_added"]).optional(),
});

export type SearchAnalyticsFilters = z.infer<typeof searchAnalyticsFiltersSchema>;
export type TrackSearchQuery = z.infer<typeof trackSearchQuerySchema>;
export type TrackSearchResult = z.infer<typeof trackSearchResultSchema>;
export type RecordResultClick = z.infer<typeof recordResultClickSchema>;

class SearchAnalyticsService {
  private readonly cacheTimeout = 300; // 5 minutes

  // Search Query Tracking
  async trackSearchQuery(userId: string, data: TrackSearchQuery): Promise<SearchQuery> {
    const qualityScore = this.calculateSearchQualityScore(data);
    const effectivenessScore = this.calculateSearchEffectivenessScore(data);

    const searchQuery: InsertSearchQuery = {
      userId,
      query: data.query,
      filters: data.filters || {},
      executionTime: data.executionTime,
      resultsCount: data.resultsCount,
      qualityScore: qualityScore.toString(),
      effectivenessScore: effectivenessScore.toString(),
      searchSource: data.searchSource,
      sessionId: data.sessionId || this.generateSessionId(userId),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      searchIntent: data.searchIntent,
    };

    const [query] = await db.insert(searchQueries).values(searchQuery).returning();

    // Update session statistics
    if (searchQuery.sessionId) {
      await this.updateSearchSession(userId, searchQuery.sessionId, query);
    }

    // Generate optimization suggestions if quality is below threshold
    if (qualityScore < ANALYTICS_CONFIG.QUALITY_THRESHOLDS.MEDIUM) {
      await this.generateOptimizationSuggestions(userId, query);
    }

    // Invalidate cache
    await this.invalidateAnalyticsCache(userId);

    return query;
  }

  // Search Result Tracking
  async trackSearchResults(userId: string, results: TrackSearchResult[]): Promise<SearchResult[]> {
    const insertData: InsertSearchResult[] = results.map((result) => ({
      queryId: result.queryId,
      prospectId: result.prospectId,
      position: result.position,
      relevanceScore: result.relevanceScore.toString(),
      qualityScore: result.qualityScore.toString(),
      dataCompletenessScore: result.dataCompletenessScore.toString(),
      resultSource: result.resultSource,
      resultMetadata: result.resultMetadata || {},
    }));

    const searchResults = await db.insert(searchResults).values(insertData).returning();

    // Invalidate cache
    await this.invalidateAnalyticsCache(userId);

    return searchResults;
  }

  // Result Click Tracking
  async recordResultClick(userId: string, data: RecordResultClick): Promise<SearchResult | null> {
    const [result] = await db
      .update(searchResults)
      .set({
        clicked: true,
        timeToClick: data.timeToClick,
        conversionAction: data.conversionAction,
      })
      .where(eq(searchResults.id, data.resultId))
      .returning();

    if (result) {
      // Update query click-through rate
      await this.updateQueryClickThroughRate(result.queryId);
      
      // Update session statistics
      const query = await db.query.searchQueries.findFirst({
        where: eq(searchQueries.id, result.queryId),
      });
      
      if (query?.sessionId) {
        await this.updateSessionClickStats(query.sessionId);
      }

      // Invalidate cache
      await this.invalidateAnalyticsCache(userId);
    }

    return result || null;
  }

  // Search Performance Analytics
  async getSearchPerformanceMetrics(userId: string, filters: SearchAnalyticsFilters = {}) {
    const cacheKey = `search-performance:${userId}:${JSON.stringify(filters)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const whereConditions = [eq(searchQueries.userId, userId)];

    if (filters.dateFrom) {
      whereConditions.push(gte(searchQueries.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      whereConditions.push(lte(searchQueries.createdAt, new Date(filters.dateTo)));
    }
    if (filters.searchSource) {
      whereConditions.push(eq(searchQueries.searchSource, filters.searchSource));
    }
    if (filters.searchIntent) {
      whereConditions.push(eq(searchQueries.searchIntent, filters.searchIntent));
    }

    const [metrics] = await db
      .select({
        totalQueries: count(),
        averageExecutionTime: avg(searchQueries.executionTime),
        averageResultsCount: avg(searchQueries.resultsCount),
        averageQualityScore: avg(searchQueries.qualityScore),
        averageEffectivenessScore: avg(searchQueries.effectivenessScore),
        averageClickThroughRate: avg(searchQueries.clickThroughRate),
        averageConversionRate: avg(searchQueries.conversionRate),
      })
      .from(searchQueries)
      .where(and(...whereConditions));

    const result = {
      ...metrics,
      totalQueries: Number(metrics.totalQueries) || 0,
      averageExecutionTime: Number(metrics.averageExecutionTime) || 0,
      averageResultsCount: Number(metrics.averageResultsCount) || 0,
      averageQualityScore: Number(metrics.averageQualityScore) || 0,
      averageEffectivenessScore: Number(metrics.averageEffectivenessScore) || 0,
      averageClickThroughRate: Number(metrics.averageClickThroughRate) || 0,
      averageConversionRate: Number(metrics.averageConversionRate) || 0,
    };

    await cacheService.set(cacheKey, result, this.cacheTimeout);
    return result;
  }

  // Search Quality Analysis
  async getSearchQualityAnalysis(userId: string, filters: SearchAnalyticsFilters = {}) {
    const cacheKey = `search-quality:${userId}:${JSON.stringify(filters)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const whereConditions = [eq(searchQueries.userId, userId)];

    if (filters.dateFrom) {
      whereConditions.push(gte(searchQueries.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      whereConditions.push(lte(searchQueries.createdAt, new Date(filters.dateTo)));
    }

    // Quality distribution
    const qualityDistribution = await db
      .select({
        qualityRange: sql<string>`
          CASE 
            WHEN CAST(quality_score as INTEGER) >= ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.HIGH} THEN 'high'
            WHEN CAST(quality_score as INTEGER) >= ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.MEDIUM} THEN 'medium' 
            ELSE 'low'
          END
        `,
        count: count(),
      })
      .from(searchQueries)
      .where(and(...whereConditions))
      .groupBy(sql`
        CASE 
          WHEN CAST(quality_score as INTEGER) >= ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.HIGH} THEN 'high'
          WHEN CAST(quality_score as INTEGER) >= ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.MEDIUM} THEN 'medium' 
          ELSE 'low'
        END
      `);

    // Top performing queries
    const topQueries = await db
      .select({
        query: searchQueries.query,
        qualityScore: searchQueries.qualityScore,
        effectivenessScore: searchQueries.effectivenessScore,
        resultsCount: searchQueries.resultsCount,
        clickThroughRate: searchQueries.clickThroughRate,
        conversionRate: searchQueries.conversionRate,
      })
      .from(searchQueries)
      .where(and(...whereConditions))
      .orderBy(desc(searchQueries.qualityScore))
      .limit(10);

    // Underperforming queries
    const underperformingQueries = await db
      .select({
        query: searchQueries.query,
        qualityScore: searchQueries.qualityScore,
        effectivenessScore: searchQueries.effectivenessScore,
        resultsCount: searchQueries.resultsCount,
        issues: sql<string[]>`
          CASE 
            WHEN results_count = 0 THEN ARRAY['no_results']
            WHEN CAST(quality_score as INTEGER) < ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.LOW} THEN ARRAY['low_quality']
            WHEN CAST(click_through_rate as DECIMAL) < 0.1 THEN ARRAY['low_ctr']
            ELSE ARRAY[]::text[]
          END
        `,
      })
      .from(searchQueries)
      .where(
        and(
          ...whereConditions,
          sql`CAST(quality_score as INTEGER) < ${ANALYTICS_CONFIG.QUALITY_THRESHOLDS.MEDIUM}`
        )
      )
      .orderBy(searchQueries.qualityScore)
      .limit(10);

    const result = {
      qualityDistribution: qualityDistribution.map(item => ({
        qualityRange: item.qualityRange,
        count: Number(item.count),
      })),
      topQueries: topQueries.map(query => ({
        ...query,
        qualityScore: Number(query.qualityScore),
        effectivenessScore: Number(query.effectivenessScore),
        clickThroughRate: Number(query.clickThroughRate),
        conversionRate: Number(query.conversionRate),
      })),
      underperformingQueries: underperformingQueries.map(query => ({
        ...query,
        qualityScore: Number(query.qualityScore),
        effectivenessScore: Number(query.effectivenessScore),
        issues: query.issues || [],
      })),
    };

    await cacheService.set(cacheKey, result, this.cacheTimeout);
    return result;
  }

  // Search Behavior Analysis
  async getSearchBehaviorAnalysis(userId: string, filters: SearchAnalyticsFilters = {}) {
    const cacheKey = `search-behavior:${userId}:${JSON.stringify(filters)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const whereConditions = [eq(searchQueries.userId, userId)];

    if (filters.dateFrom) {
      whereConditions.push(gte(searchQueries.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      whereConditions.push(lte(searchQueries.createdAt, new Date(filters.dateTo)));
    }

    // Search patterns by time of day
    const hourlyPatterns = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM created_at)`,
        queryCount: count(),
        averageQuality: avg(searchQueries.qualityScore),
      })
      .from(searchQueries)
      .where(and(...whereConditions))
      .groupBy(sql`EXTRACT(HOUR FROM created_at)`)
      .orderBy(sql`EXTRACT(HOUR FROM created_at)`);

    // Common search intents
    const intentAnalysis = await db
      .select({
        intent: searchQueries.searchIntent,
        count: count(),
        averageResultsCount: avg(searchQueries.resultsCount),
        averageQualityScore: avg(searchQueries.qualityScore),
        successRate: sql<number>`
          AVG(CASE WHEN CAST(conversion_rate as DECIMAL) > 0 THEN 1 ELSE 0 END)
        `,
      })
      .from(searchQueries)
      .where(and(...whereConditions, sql`search_intent IS NOT NULL`))
      .groupBy(searchQueries.searchIntent);

    // Search refinement patterns
    const refinementPatterns = await db
      .select({
        refinements: searchQueries.refinements,
        count: count(),
        averageQualityImprovement: sql<number>`
          AVG(CASE WHEN refinements > 0 THEN CAST(quality_score as DECIMAL) ELSE 0 END) -
          AVG(CASE WHEN refinements = 0 THEN CAST(quality_score as DECIMAL) ELSE 0 END)
        `,
      })
      .from(searchQueries)
      .where(and(...whereConditions))
      .groupBy(searchQueries.refinements)
      .orderBy(searchQueries.refinements);

    const result = {
      hourlyPatterns: hourlyPatterns.map(pattern => ({
        hour: Number(pattern.hour),
        queryCount: Number(pattern.queryCount),
        averageQuality: Number(pattern.averageQuality) || 0,
      })),
      intentAnalysis: intentAnalysis.map(intent => ({
        intent: intent.intent,
        count: Number(intent.count),
        averageResultsCount: Number(intent.averageResultsCount) || 0,
        averageQualityScore: Number(intent.averageQualityScore) || 0,
        successRate: Number(intent.successRate) || 0,
      })),
      refinementPatterns: refinementPatterns.map(pattern => ({
        refinements: Number(pattern.refinements) || 0,
        count: Number(pattern.count),
        averageQualityImprovement: Number(pattern.averageQualityImprovement) || 0,
      })),
    };

    await cacheService.set(cacheKey, result, this.cacheTimeout);
    return result;
  }

  // Search Optimization Recommendations
  async getOptimizationRecommendations(userId: string, limit = 10): Promise<SearchOptimization[]> {
    const cacheKey = `search-optimizations:${userId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const optimizations = await db
      .select()
      .from(searchOptimizations)
      .where(
        and(
          eq(searchOptimizations.userId, userId),
          eq(searchOptimizations.applied, false),
          sql`expires_at IS NULL OR expires_at > NOW()`
        )
      )
      .orderBy(desc(searchOptimizations.improvementScore))
      .limit(limit);

    await cacheService.set(cacheKey, optimizations, this.cacheTimeout);
    return optimizations;
  }

  // Search Insights Generation
  async getSearchInsights(userId: string, limit = 20): Promise<SearchInsight[]> {
    const cacheKey = `search-insights:${userId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const insights = await db
      .select()
      .from(searchInsights)
      .where(
        and(
          eq(searchInsights.userId, userId),
          sql`dismissed_at IS NULL`,
          sql`expires_at IS NULL OR expires_at > NOW()`
        )
      )
      .orderBy(desc(searchInsights.priority), desc(searchInsights.createdAt))
      .limit(limit);

    await cacheService.set(cacheKey, insights, this.cacheTimeout);
    return insights;
  }

  // Apply Search Optimization
  async applyOptimization(userId: string, optimizationId: string, feedback?: string): Promise<SearchOptimization | null> {
    const [optimization] = await db
      .update(searchOptimizations)
      .set({
        applied: true,
        feedback: feedback || null,
      })
      .where(
        and(
          eq(searchOptimizations.id, optimizationId),
          eq(searchOptimizations.userId, userId)
        )
      )
      .returning();

    if (optimization) {
      await this.invalidateAnalyticsCache(userId);
    }

    return optimization || null;
  }

  // Dismiss Search Insight
  async dismissInsight(userId: string, insightId: string): Promise<SearchInsight | null> {
    const [insight] = await db
      .update(searchInsights)
      .set({
        dismissedAt: new Date(),
      })
      .where(
        and(
          eq(searchInsights.id, insightId),
          eq(searchInsights.userId, userId)
        )
      )
      .returning();

    if (insight) {
      await this.invalidateAnalyticsCache(userId);
    }

    return insight || null;
  }

  // Private Helper Methods
  private calculateSearchQualityScore(data: TrackSearchQuery): number {
    let score = 50; // Base score

    // Query specificity (longer, more specific queries score higher)
    const queryWords = data.query.trim().split(/\s+/).length;
    if (queryWords >= 5) score += 15;
    else if (queryWords >= 3) score += 10;
    else if (queryWords >= 2) score += 5;

    // Results count (optimal range is 10-100 results)
    if (data.resultsCount >= 10 && data.resultsCount <= 100) score += 20;
    else if (data.resultsCount > 0) score += 10;

    // Execution time (faster searches score higher)
    if (data.executionTime < 1000) score += 15; // < 1 second
    else if (data.executionTime < 3000) score += 10; // < 3 seconds
    else if (data.executionTime < 5000) score += 5; // < 5 seconds

    // Filter usage (searches with filters are more targeted)
    if (data.filters && Object.keys(data.filters).length > 0) {
      score += Math.min(Object.keys(data.filters).length * 5, 20);
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateSearchEffectivenessScore(data: TrackSearchQuery): number {
    let score = 40; // Base score

    // Results relevance (having results is good, too many might indicate poor targeting)
    if (data.resultsCount > 0 && data.resultsCount <= 50) score += 30;
    else if (data.resultsCount > 0) score += 20;

    // Query intent clarity
    if (data.searchIntent) score += 15;

    // Search source context (API searches are typically more purposeful)
    if (data.searchSource === "api") score += 10;
    else if (data.searchSource === "web") score += 5;

    // Performance factor
    if (data.executionTime < 2000) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private generateSessionId(userId: string): string {
    return `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async updateSearchSession(userId: string, sessionId: string, query: SearchQuery): Promise<void> {
    // Check if session exists
    const existingSession = await db.query.searchSessions.findFirst({
      where: eq(searchSessions.id, sessionId),
    });

    if (existingSession) {
      // Update existing session
      await db
        .update(searchSessions)
        .set({
          totalQueries: existingSession.totalQueries + 1,
          totalResults: existingSession.totalResults + query.resultsCount,
          averageQualityScore: sql`(${existingSession.averageQualityScore} * ${existingSession.totalQueries} + ${query.qualityScore}) / ${existingSession.totalQueries + 1}`,
        })
        .where(eq(searchSessions.id, sessionId));
    } else {
      // Create new session
      const newSession: InsertSearchSession = {
        id: sessionId,
        userId,
        totalQueries: 1,
        totalResults: query.resultsCount,
        averageQualityScore: query.qualityScore,
      };

      await db.insert(searchSessions).values(newSession);
    }
  }

  private async updateQueryClickThroughRate(queryId: string): Promise<void> {
    // Calculate CTR for the query
    const results = await db
      .select({
        totalResults: count(),
        clickedResults: sum(sql`CASE WHEN clicked THEN 1 ELSE 0 END`),
      })
      .from(searchResults)
      .where(eq(searchResults.queryId, queryId));

    if (results[0] && results[0].totalResults > 0) {
      const ctr = Number(results[0].clickedResults) / Number(results[0].totalResults);
      
      await db
        .update(searchQueries)
        .set({
          clickThroughRate: ctr.toString(),
        })
        .where(eq(searchQueries.id, queryId));
    }
  }

  private async updateSessionClickStats(sessionId: string): Promise<void> {
    const session = await db.query.searchSessions.findFirst({
      where: eq(searchSessions.id, sessionId),
    });

    if (session) {
      await db
        .update(searchSessions)
        .set({
          totalClicks: session.totalClicks + 1,
        })
        .where(eq(searchSessions.id, sessionId));
    }
  }

  private async generateOptimizationSuggestions(userId: string, query: SearchQuery): Promise<void> {
    const suggestions: InsertSearchOptimization[] = [];

    // Spelling suggestions
    if (this.hasSpellingErrors(query.query)) {
      suggestions.push({
        userId,
        originalQuery: query.query,
        optimizedQuery: this.suggestSpellingCorrections(query.query),
        optimizationType: "spelling",
        improvementScore: "25",
        automationLevel: "suggestion",
      });
    }

    // Query expansion suggestions
    if (query.resultsCount === 0) {
      suggestions.push({
        userId,
        originalQuery: query.query,
        optimizedQuery: this.suggestQueryExpansion(query.query),
        optimizationType: "expansion",
        improvementScore: "35",
        automationLevel: "suggestion",
      });
    }

    // Query refinement suggestions
    if (query.resultsCount > 1000) {
      suggestions.push({
        userId,
        originalQuery: query.query,
        optimizedQuery: this.suggestQueryRefinement(query.query),
        optimizationType: "refinement",
        improvementScore: "30",
        automationLevel: "suggestion",
      });
    }

    if (suggestions.length > 0) {
      await db.insert(searchOptimizations).values(suggestions);
    }
  }

  private hasSpellingErrors(query: string): boolean {
    // Simple heuristic for common misspellings
    const commonMisspellings = ['recieve', 'seperate', 'definately', 'managment', 'developement'];
    return commonMisspellings.some(mistake => query.toLowerCase().includes(mistake));
  }

  private suggestSpellingCorrections(query: string): string {
    const corrections = {
      'recieve': 'receive',
      'seperate': 'separate', 
      'definately': 'definitely',
      'managment': 'management',
      'developement': 'development',
    };

    let corrected = query;
    Object.entries(corrections).forEach(([mistake, correction]) => {
      corrected = corrected.replace(new RegExp(mistake, 'gi'), correction);
    });

    return corrected;
  }

  private suggestQueryExpansion(query: string): string {
    // Add common synonyms and related terms
    const expansions = {
      'CEO': 'CEO OR "Chief Executive Officer" OR President',
      'CTO': 'CTO OR "Chief Technology Officer" OR "Head of Technology"',
      'marketing': 'marketing OR advertising OR promotion OR branding',
      'sales': 'sales OR revenue OR business development OR account management',
    };

    for (const [term, expansion] of Object.entries(expansions)) {
      if (query.toLowerCase().includes(term.toLowerCase())) {
        return query.replace(new RegExp(term, 'gi'), expansion);
      }
    }

    return query;
  }

  private suggestQueryRefinement(query: string): string {
    // Add refinement filters to narrow down results
    const refinements = [
      ' AND company_size:"51-200"',
      ' AND industry:"Technology"',
      ' AND location:"United States"',
    ];

    return query + refinements[Math.floor(Math.random() * refinements.length)];
  }

  private async invalidateAnalyticsCache(userId: string): Promise<void> {
    const patterns = [
      `search-performance:${userId}:*`,
      `search-quality:${userId}:*`,
      `search-behavior:${userId}:*`,
      `search-optimizations:${userId}:*`,
      `search-insights:${userId}:*`,
    ];

    for (const pattern of patterns) {
      await cacheService.invalidatePattern(pattern);
    }
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();