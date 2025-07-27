/**
 * CARD-007: Test Routes for Prospect Search Engine (Development Only)
 * Non-authenticated endpoints for testing search functionality
 */

import { Express, Request, Response } from 'express';
import { prospectSearchEngine, SearchRequest } from '../services/prospectSearchEngine';

export function registerProspectSearchTestRoutes(app: Express): void {
  console.log('🧪 Setting up Prospect Search Engine test routes...');

  /**
   * Test endpoint for prospect search (no authentication required)
   */
  app.post('/api/test/prospects/search', async (req: Request, res: Response) => {
    try {
      const searchRequest: SearchRequest = req.body;
      const testUserId = 'test_user_123';

      // Validate required fields
      if (!searchRequest.query || searchRequest.query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      // Set defaults
      if (!searchRequest.pagination) {
        searchRequest.pagination = { page: 1, limit: 10 };
      }

      if (!searchRequest.sorting) {
        searchRequest.sorting = { field: 'relevance', direction: 'desc' };
      }

      console.log(`🧪 Testing search: "${searchRequest.query}"`);

      const searchResults = await prospectSearchEngine.search(searchRequest, testUserId);

      res.json({
        success: true,
        query: searchRequest.query,
        results: searchResults.results,
        totalCount: searchResults.totalCount,
        pagination: {
          page: searchRequest.pagination.page,
          limit: searchRequest.pagination.limit,
          totalPages: Math.ceil(searchResults.totalCount / searchRequest.pagination.limit)
        },
        searchAnalytics: {
          queryId: searchResults.searchAnalytics.queryId,
          executionTime: searchResults.executionTime,
          sources: searchResults.sources,
          resultsCount: searchResults.results.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Test search error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: (error as Error).message
      });
    }
  });

  /**
   * Test search analytics endpoint
   */
  app.get('/api/test/prospects/search/analytics', async (req: Request, res: Response) => {
    try {
      const testUserId = 'test_user_123';
      const { timeframe = 'month' } = req.query;

      const metrics = await prospectSearchEngine.getSearchMetrics(
        testUserId, 
        timeframe as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        metrics,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Test analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve search analytics'
      });
    }
  });

  console.log('✅ Prospect Search Engine test routes configured');
}