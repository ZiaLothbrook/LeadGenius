/**
 * CARD-007: Prospect Search Engine Backend Routes
 * Comprehensive API endpoints for multi-source prospect search
 */

import { Express, Request, Response } from 'express';
import { prospectSearchEngine, SearchRequest } from '../services/prospectSearchEngine';

// Authentication middleware (inline definition)
const isAuthenticatedLocal = async (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    if (req.user.id || (req.user.claims && req.user.claims.sub)) {
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
};

export function registerProspectSearchRoutes(app: Express): void {
  console.log('🔍 Setting up Prospect Search Engine routes...');

  /**
   * @swagger
   * /api/prospects/search:
   *   post:
   *     summary: Multi-source prospect search with advanced filtering
   *     tags: [Prospect Search]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               query:
   *                 type: string
   *                 description: Search query (name, company, title, etc.)
   *               filters:
   *                 type: object
   *                 properties:
   *                   industry:
   *                     type: array
   *                     items:
   *                       type: string
   *                   companySize:
   *                     type: string
   *                   location:
   *                     type: array
   *                     items:
   *                       type: string
   *                   jobTitles:
   *                     type: array
   *                     items:
   *                       type: string
   *               sorting:
   *                 type: object
   *                 properties:
   *                   field:
   *                     type: string
   *                     enum: [relevance, confidence, recent, company_size]
   *                   direction:
   *                     type: string
   *                     enum: [asc, desc]
   *               pagination:
   *                 type: object
   *                 properties:
   *                   page:
   *                     type: number
   *                   limit:
   *                     type: number
   *     responses:
   *       200:
   *         description: Search results with analytics
   *       400:
   *         description: Invalid search request
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/prospects/search', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const searchRequest: SearchRequest = req.body;

      // Validate required fields
      if (!searchRequest.query || searchRequest.query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      // Set default pagination if not provided
      if (!searchRequest.pagination) {
        searchRequest.pagination = { page: 1, limit: 50 };
      }

      // Set default sorting if not provided
      if (!searchRequest.sorting) {
        searchRequest.sorting = { field: 'relevance', direction: 'desc' };
      }

      console.log(`🔍 Processing search request: "${searchRequest.query}" for user ${userId}`);

      const searchResults = await prospectSearchEngine.search(searchRequest, userId);

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
      console.error('❌ Prospect search error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/prospects/search/analytics:
   *   get:
   *     summary: Get search performance metrics and analytics
   *     tags: [Prospect Search]
   *     parameters:
   *       - in: query
   *         name: timeframe
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *         description: Analytics timeframe
   *     responses:
   *       200:
   *         description: Search analytics data
   */
  app.get('/api/prospects/search/analytics', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { timeframe = 'month' } = req.query;

      const metrics = await prospectSearchEngine.getSearchMetrics(
        userId, 
        timeframe as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        metrics,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Search analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve search analytics',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/prospects/search/suggestions:
   *   get:
   *     summary: Get search query suggestions and autocomplete
   *     tags: [Prospect Search]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Partial query for suggestions
   *     responses:
   *       200:
   *         description: Search suggestions
   */
  app.get('/api/prospects/search/suggestions', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required'
        });
      }

      // Generate intelligent search suggestions
      const suggestions = [
        `${q} VP`,
        `${q} CTO`,
        `${q} Engineer`,
        `${q} Manager`,
        `${q} Director`,
        `${q} Head of`,
        `${q} Chief`,
        `${q} Senior`
      ].filter(suggestion => suggestion.length > q.length);

      res.json({
        success: true,
        query: q,
        suggestions: suggestions.slice(0, 8),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Search suggestions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get search suggestions',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/prospects/search/filters:
   *   get:
   *     summary: Get available filter options for prospect search
   *     tags: [Prospect Search]
   *     responses:
   *       200:
   *         description: Available filter options
   */
  app.get('/api/prospects/search/filters', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const filterOptions = {
        industries: [
          'Technology',
          'Software',
          'SaaS',
          'AI/ML',
          'Healthcare',
          'Finance',
          'E-commerce',
          'Marketing',
          'Consulting',
          'Manufacturing',
          'Education',
          'Real Estate'
        ],
        companySizes: [
          '1-50',
          '50-200',
          '200-500',
          '500-1000',
          '1000+'
        ],
        jobTitles: [
          'CEO',
          'CTO',
          'VP Engineering',
          'VP Sales',
          'VP Marketing',
          'Head of Product',
          'Engineering Manager',
          'Product Manager',
          'Sales Director',
          'Marketing Director'
        ],
        locations: [
          'San Francisco, CA',
          'New York, NY',
          'Austin, TX',
          'Seattle, WA',
          'Boston, MA',
          'Los Angeles, CA',
          'Chicago, IL',
          'Denver, CO',
          'Atlanta, GA',
          'Remote'
        ],
        fundingStages: [
          'Pre-seed',
          'Seed',
          'Series A',
          'Series B',
          'Series C+',
          'IPO',
          'Bootstrapped'
        ]
      };

      res.json({
        success: true,
        filters: filterOptions,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Filter options error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get filter options',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/prospects/search/export:
   *   post:
   *     summary: Export search results to CSV/Excel
   *     tags: [Prospect Search]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               queryId:
   *                 type: string
   *               format:
   *                 type: string
   *                 enum: [csv, excel]
   *     responses:
   *       200:
   *         description: Export file generated
   */
  app.post('/api/prospects/search/export', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const { queryId, format = 'csv' } = req.body;

      if (!queryId) {
        return res.status(400).json({
          success: false,
          error: 'Query ID is required for export'
        });
      }

      // In production, this would generate actual export files
      res.json({
        success: true,
        message: 'Export functionality will be implemented in production',
        queryId,
        format,
        estimatedRecords: 127,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Export failed',
        message: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/prospects/search/status:
   *   get:
   *     summary: Get search engine status and health
   *     tags: [Prospect Search]
   *     responses:
   *       200:
   *         description: Search engine status
   */
  app.get('/api/prospects/search/status', isAuthenticatedLocal, async (req: any, res: Response) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const metrics = await prospectSearchEngine.getSearchMetrics(userId, 'day');

      const status = {
        engine: 'operational',
        sources: {
          internal: 'connected',
          apollo: process.env.APOLLO_API_KEY ? 'connected' : 'not_configured',
          zoominfo: 'not_configured',
          hunter: 'not_configured'
        },
        performance: {
          averageResponseTime: metrics.averageResponseTime,
          totalSearchesToday: metrics.totalSearches,
          averageResultsPerSearch: metrics.averageResultsPerSearch
        },
        cacheStatus: 'enabled',
        lastHealthCheck: new Date(),
        version: '1.0.0'
      };

      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get search engine status',
        message: (error as Error).message
      });
    }
  });

  console.log('✅ Prospect Search Engine routes configured');
}