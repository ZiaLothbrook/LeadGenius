import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

/**
 * API Documentation and OpenAPI Specification Generator
 * Provides comprehensive API documentation with interactive Swagger UI
 */
export class ApiDocumentation {
  private static instance: ApiDocumentation;
  private swaggerSpec: any;

  public static getInstance(): ApiDocumentation {
    if (!ApiDocumentation.instance) {
      ApiDocumentation.instance = new ApiDocumentation();
    }
    return ApiDocumentation.instance;
  }

  /**
   * Initialize API documentation
   */
  public initializeDocumentation(app: Express): void {
    console.log('📖 Initializing API documentation system...');

    this.generateSwaggerSpec();
    this.setupSwaggerUI(app);
    this.setupApiEndpoints(app);

    console.log('✅ API documentation initialized successfully');
    console.log('📖 API docs available at: /api-docs');
  }

  /**
   * Generate OpenAPI/Swagger specification
   */
  private generateSwaggerSpec(): void {
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'LeadGen AI Platform API',
          version: '1.0.0',
          description: `
            Comprehensive AI-powered lead generation and prospect intelligence platform API.
            
            ## Features
            - Multi-source data integration (Apollo.io, ZoomInfo, Hunter.io)
            - AI-powered prospect enrichment and message generation
            - Advanced email delivery system with Postmark integration
            - LinkedIn messaging compliance system
            - Campaign execution and analytics
            - Real-time data quality scoring and deduplication
            
            ## Authentication
            This API uses session-based authentication with support for API keys.
            All endpoints require authentication unless explicitly marked as public.
            
            ## Rate Limits
            - General API: 1000 requests per 15 minutes
            - AI endpoints: 500 requests per hour
            - Authentication: 100 requests per hour
            
            ## Error Handling
            All errors follow RFC 7807 Problem Details format with consistent structure.
          `,
          contact: {
            name: 'API Support',
            email: 'support@leadgen-ai.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: process.env.NODE_ENV === 'production' 
              ? 'https://leadgen-ai.replit.app/api' 
              : 'http://localhost:5000/api',
            description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            sessionAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'connect.sid',
              description: 'Session-based authentication cookie'
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
              description: 'API key for programmatic access'
            }
          },
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                profileImageUrl: { type: 'string', format: 'uri' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            Prospect: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                userId: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string' },
                company: { type: 'string' },
                title: { type: 'string' },
                industry: { type: 'string' },
                location: { type: 'string' },
                linkedinUrl: { type: 'string', format: 'uri' },
                websiteUrl: { type: 'string', format: 'uri' },
                dataSources: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Sources that provided data for this prospect'
                },
                dataQuality: { 
                  type: 'integer', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Overall data quality score'
                },
                isVerified: { type: 'boolean' },
                aiScore: { 
                  type: 'integer', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'AI-generated lead score'
                },
                priorityLevel: { 
                  type: 'string', 
                  enum: ['high', 'medium', 'low'] 
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            Campaign: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                userId: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                type: { 
                  type: 'string', 
                  enum: ['email', 'linkedin', 'phone', 'multi-channel'] 
                },
                status: { 
                  type: 'string', 
                  enum: ['draft', 'active', 'paused', 'completed'] 
                },
                subject: { type: 'string' },
                messageTemplate: { type: 'string' },
                goal: { type: 'string' },
                tone: { type: 'string' },
                totalProspects: { type: 'integer' },
                sent: { type: 'integer' },
                delivered: { type: 'integer' },
                opened: { type: 'integer' },
                replied: { type: 'integer' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            Message: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                userId: { type: 'string', format: 'uuid' },
                campaignId: { type: 'string', format: 'uuid' },
                prospectId: { type: 'string', format: 'uuid' },
                subject: { type: 'string' },
                content: { type: 'string' },
                type: { 
                  type: 'string', 
                  enum: ['email', 'linkedin', 'sms', 'phone_script'] 
                },
                tone: { type: 'string' },
                aiGenerated: { type: 'boolean' },
                confidenceScore: { 
                  type: 'integer', 
                  minimum: 0, 
                  maximum: 100 
                },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            Error: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                details: { type: 'object' }
              }
            },
            ProspectSearchFilters: {
              type: 'object',
              properties: {
                keywords: { type: 'string' },
                company: { type: 'string' },
                title: { type: 'string' },
                industry: { type: 'string' },
                location: { type: 'string' },
                companySize: { type: 'string' },
                experience: { type: 'string' },
                technologies: { 
                  type: 'array', 
                  items: { type: 'string' } 
                },
                page: { type: 'integer', minimum: 1, default: 1 },
                perPage: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
              }
            },
            RateLimitStatus: {
              type: 'object',
              properties: {
                identifier: { type: 'string' },
                limits: {
                  type: 'object',
                  properties: {
                    general: {
                      type: 'object',
                      properties: {
                        max: { type: 'integer' },
                        window: { type: 'string' }
                      }
                    },
                    ai: {
                      type: 'object',
                      properties: {
                        max: { type: 'integer' },
                        window: { type: 'string' }
                      }
                    },
                    auth: {
                      type: 'object',
                      properties: {
                        max: { type: 'integer' },
                        window: { type: 'string' }
                      }
                    }
                  }
                },
                current: {
                  type: 'object',
                  properties: {
                    general: { type: 'integer' },
                    ai: { type: 'integer' },
                    auth: { type: 'integer' }
                  }
                }
              }
            }
          },
          responses: {
            Unauthorized: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            Forbidden: {
              description: 'Insufficient permissions',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            NotFound: {
              description: 'Resource not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            RateLimitExceeded: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            ValidationError: {
              description: 'Request validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            InternalServerError: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        security: [
          { sessionAuth: [] },
          { apiKeyAuth: [] }
        ],
        tags: [
          {
            name: 'Authentication',
            description: 'User authentication and session management'
          },
          {
            name: 'Prospects',
            description: 'Lead and prospect management operations'
          },
          {
            name: 'Campaigns',
            description: 'Campaign creation and execution'
          },
          {
            name: 'Messages',
            description: 'AI-powered message generation'
          },
          {
            name: 'Analytics',
            description: 'Performance metrics and reporting'
          },
          {
            name: 'AI Services',
            description: 'AI-powered enrichment and insights'
          },
          {
            name: 'Data Sources',
            description: 'Multi-source data integration'
          },
          {
            name: 'Email Delivery',
            description: 'Email delivery system and optimization'
          },
          {
            name: 'LinkedIn',
            description: 'LinkedIn messaging and compliance'
          },
          {
            name: 'Admin',
            description: 'Administrative operations and monitoring'
          }
        ]
      },
      apis: [
        './server/routes.ts',
        './server/services/*.ts',
        './server/middleware/*.ts'
      ]
    };

    this.swaggerSpec = swaggerJsdoc(options);
  }

  /**
   * Setup Swagger UI
   */
  private setupSwaggerUI(app: Express): void {
    const swaggerUiOptions = {
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info h1 { color: #2563eb }
        .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px }
      `,
      customSiteTitle: 'LeadGen AI Platform API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        requestInterceptor: (req: any) => {
          // Add request ID to all API calls
          req.headers['X-Request-ID'] = this.generateRequestId();
          return req;
        }
      }
    };

    // Serve API documentation
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(this.swaggerSpec, swaggerUiOptions));

    // Serve OpenAPI spec as JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(this.swaggerSpec);
    });
  }

  /**
   * Setup additional API documentation endpoints
   */
  private setupApiEndpoints(app: Express): void {
    // API status and information
    app.get('/api/info', (req, res) => {
      res.json({
        name: 'LeadGen AI Platform API',
        version: '1.0.0',
        description: 'AI-powered lead generation and prospect intelligence platform',
        documentation: '/api-docs',
        openapi: '/api-docs.json',
        status: 'operational',
        timestamp: new Date().toISOString(),
        features: {
          multiSourceDataIntegration: true,
          aiProspectEnrichment: true,
          emailDeliverySystem: true,
          linkedinMessaging: true,
          campaignExecution: true,
          realTimeAnalytics: true,
          rateLimit: true,
          apiDocumentation: true
        },
        limits: {
          general: '1000 requests per 15 minutes',
          ai: '500 requests per hour',
          authentication: '100 requests per hour'
        },
        supportedFormats: ['JSON'],
        supportedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      });
    });

    // API schema validation endpoint
    app.get('/api/schema/:schemaName', (req, res) => {
      const { schemaName } = req.params;
      const schema = this.swaggerSpec?.components?.schemas?.[schemaName];
      
      if (!schema) {
        return res.status(404).json({
          error: 'Schema not found',
          availableSchemas: Object.keys(this.swaggerSpec?.components?.schemas || {})
        });
      }

      res.json({
        name: schemaName,
        schema,
        example: this.generateSchemaExample(schema)
      });
    });

    // API endpoints summary
    app.get('/api/endpoints', (req, res) => {
      const endpoints = this.extractEndpointsFromSpec();
      res.json({
        total: endpoints.length,
        endpoints: endpoints.map(endpoint => ({
          path: endpoint.path,
          method: endpoint.method,
          summary: endpoint.summary,
          tags: endpoint.tags,
          authenticated: endpoint.authenticated,
          rateLimit: endpoint.rateLimit
        }))
      });
    });
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate example data for a schema
   */
  private generateSchemaExample(schema: any): any {
    if (!schema || !schema.properties) {
      return {};
    }

    const example: any = {};
    
    for (const [key, property] of Object.entries(schema.properties)) {
      const prop = property as any;
      
      switch (prop.type) {
        case 'string':
          if (prop.format === 'email') {
            example[key] = 'user@example.com';
          } else if (prop.format === 'date-time') {
            example[key] = new Date().toISOString();
          } else if (prop.format === 'uuid') {
            example[key] = '123e4567-e89b-12d3-a456-426614174000';
          } else if (prop.format === 'uri') {
            example[key] = 'https://example.com';
          } else if (prop.enum) {
            example[key] = prop.enum[0];
          } else {
            example[key] = 'string';
          }
          break;
        case 'integer':
          example[key] = prop.minimum || 0;
          break;
        case 'number':
          example[key] = prop.minimum || 0.0;
          break;
        case 'boolean':
          example[key] = false;
          break;
        case 'array':
          example[key] = [];
          break;
        case 'object':
          example[key] = {};
          break;
        default:
          example[key] = null;
      }
    }

    return example;
  }

  /**
   * Extract endpoints from OpenAPI spec
   */
  private extractEndpointsFromSpec(): any[] {
    const endpoints: any[] = [];
    const paths = this.swaggerSpec?.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, spec] of Object.entries(methods as any)) {
        if (typeof spec === 'object' && spec !== null) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: (spec as any).summary || 'No summary available',
            tags: (spec as any).tags || [],
            authenticated: !!(spec as any).security,
            rateLimit: path.includes('/api/ai') || path.includes('/enrich') ? 'AI limits' : 'General limits'
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Get the generated OpenAPI specification
   */
  public getSpec(): any {
    return this.swaggerSpec;
  }

  /**
   * Validate request against schema
   */
  public validateRequest(schemaName: string, data: any): { valid: boolean; errors: string[] } {
    const schema = this.swaggerSpec?.components?.schemas?.[schemaName];
    if (!schema) {
      return { valid: false, errors: ['Schema not found'] };
    }

    // Basic validation - in production, use a proper JSON schema validator
    const errors: string[] = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const apiDocumentation = ApiDocumentation.getInstance();