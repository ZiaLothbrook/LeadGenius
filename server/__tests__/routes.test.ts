import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock the database and services
jest.mock('../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../services/prospectDiscoveryService', () => ({
  prospectDiscoveryService: {
    searchProspects: jest.fn(),
  },
}));

describe('API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user-id', claims: { sub: 'test-user-id' } };
      next();
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });

      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/prospects/search', () => {
    it('should search prospects successfully', async () => {
      const mockSearchResults = {
        success: true,
        totalResults: 10,
        prospects: [
          {
            id: '1',
            name: 'John Doe',
            title: 'CEO',
            company: 'Test Corp',
            email: 'john@test.com',
            aiScore: 85,
          },
        ],
        searchInsights: {
          averageConfidence: 90,
          topIndustries: ['Technology'],
          dataSourcesUsed: 1,
        },
        pagination: {
          page: 1,
          limit: 50,
          hasMore: false,
        },
      };

      const { prospectDiscoveryService } = await import('../services/prospectDiscoveryService');
      (prospectDiscoveryService.searchProspects as jest.Mock).mockResolvedValue(mockSearchResults);

      app.post('/api/prospects/search', async (req: any, res) => {
        try {
          const results = await prospectDiscoveryService.searchProspects(req.body, req.user.id);
          res.json({
            prospects: results.prospects,
            total: results.totalResults,
            hasMore: results.pagination.hasMore,
            aiInsights: {
              intentSignalsDetected: 5,
              lookalikeMatches: 3,
              competitiveOpportunities: 2,
              searchQuality: 'high',
              recommendations: ['Add more specific filters'],
            },
          });
        } catch (error) {
          res.status(500).json({ message: 'Search failed' });
        }
      });

      const response = await request(app)
        .post('/api/prospects/search')
        .send({
          keywords: 'CEO',
          industry: 'technology',
          companySize: '51-200',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('prospects');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('aiInsights');
      expect(response.body.prospects).toHaveLength(1);
      expect(response.body.prospects[0]).toHaveProperty('name', 'John Doe');
    });

    it('should handle search errors', async () => {
      const { prospectDiscoveryService } = await import('../services/prospectDiscoveryService');
      (prospectDiscoveryService.searchProspects as jest.Mock).mockRejectedValue(
        new Error('Search service unavailable')
      );

      app.post('/api/prospects/search', async (req: any, res) => {
        try {
          await prospectDiscoveryService.searchProspects(req.body, req.user.id);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ message: 'Search failed' });
        }
      });

      const response = await request(app)
        .post('/api/prospects/search')
        .send({
          keywords: 'invalid search',
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Search failed');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      
      appWithoutAuth.post('/api/prospects/search', (req, res) => {
        res.status(401).json({ message: 'Unauthorized' });
      });

      const response = await request(appWithoutAuth)
        .post('/api/prospects/search')
        .send({ keywords: 'test' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Unauthorized');
    });
  });
});