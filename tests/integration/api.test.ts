import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Mock authentication for integration tests
    app.use((req: any, res, next) => {
      req.user = { 
        id: 'test-user-id', 
        claims: { sub: 'test-user-id' },
        isAuthenticated: () => true 
      };
      next();
    });

    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Authentication Flow', () => {
    it('should return user info when authenticated', async () => {
      const response = await request(app).get('/api/auth/user');
      
      expect(response.status).toBe(200);
      // Add more specific assertions based on your auth implementation
    });
  });

  describe('Prospect Search Flow', () => {
    it('should handle complete prospect search workflow', async () => {
      // Test the complete flow: search -> add to database -> retrieve
      const searchResponse = await request(app)
        .post('/api/prospects/search')
        .send({
          keywords: 'test',
          industry: 'technology',
          companySize: '51-200',
          page: 1,
          limit: 10,
        });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body).toHaveProperty('prospects');
      expect(searchResponse.body).toHaveProperty('aiInsights');

      // If we have prospects, test adding one to the database
      if (searchResponse.body.prospects.length > 0) {
        const prospect = searchResponse.body.prospects[0];
        
        const addResponse = await request(app)
          .post('/api/prospects')
          .send({
            name: prospect.name,
            title: prospect.title,
            company: prospect.company,
            email: prospect.email,
          });

        expect(addResponse.status).toBe(200);
        expect(addResponse.body).toHaveProperty('id');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid endpoints gracefully', async () => {
      const response = await request(app).get('/api/nonexistent-endpoint');
      expect(response.status).toBe(404);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/prospects/search')
        .send('invalid-json');
      
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});