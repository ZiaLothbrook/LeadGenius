/**
 * Client for communicating with Python FastAPI AI service
 */

import axios from 'axios';

interface PythonAIClientOptions {
  baseURL?: string;
  timeout?: number;
}

export class PythonAIClient {
  private client;
  private baseURL: string;

  constructor(options: PythonAIClientOptions = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8001';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: options.timeout || 120000, // 2 minutes for AI processing
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`🐍 Python AI Client initialized: ${this.baseURL}`);
  }

  /**
   * Generate personalized messages using Python AI service
   */
  async generateMessage(request: any): Promise<any> {
    try {
      console.log('🎯 Sending message generation request to Python AI service...');
      
      const response = await this.client.post('/generate-message', request);
      
      console.log('✅ Message generation completed successfully');
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Python AI service error:', error.message);
      
      if (error.response) {
        throw new Error(`AI Service Error: ${error.response.data?.detail || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('AI Service Unavailable: Unable to connect to Python AI service');
      } else {
        throw new Error(`AI Service Error: ${error.message}`);
      }
    }
  }

  /**
   * Enrich prospect data using Python AI service
   */
  async enrichProspect(request: any): Promise<any> {
    try {
      console.log('🔍 Sending prospect enrichment request to Python AI service...');
      
      const response = await this.client.post('/enrich-prospect', request);
      
      console.log('✅ Prospect enrichment completed successfully');
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Python AI service error:', error.message);
      
      if (error.response) {
        throw new Error(`AI Service Error: ${error.response.data?.detail || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('AI Service Unavailable: Unable to connect to Python AI service');
      } else {
        throw new Error(`AI Service Error: ${error.message}`);
      }
    }
  }

  /**
   * Analyze intent signals using Python AI service
   */
  async analyzeIntent(request: any): Promise<any> {
    try {
      console.log('🧠 Sending intent analysis request to Python AI service...');
      
      const response = await this.client.post('/analyze-intent', request);
      
      console.log('✅ Intent analysis completed successfully');
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Python AI service error:', error.message);
      
      if (error.response) {
        throw new Error(`AI Service Error: ${error.response.data?.detail || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('AI Service Unavailable: Unable to connect to Python AI service');
      } else {
        throw new Error(`AI Service Error: ${error.message}`);
      }
    }
  }

  /**
   * Check if Python AI service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.warn('⚠️ Python AI service health check failed');
      return false;
    }
  }

  /**
   * Get admin dashboard data
   */
  async getAdminDashboard(): Promise<any> {
    try {
      const response = await this.client.get('/admin/dashboard');
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get admin dashboard data:', error.message);
      throw new Error(`Failed to get admin dashboard: ${error.message}`);
    }
  }

  /**
   * Get prompt logs for admin panel
   */
  async getPromptLogs(params: any = {}): Promise<any> {
    try {
      const response = await this.client.get('/admin/prompts', { params });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get prompt logs:', error.message);
      throw new Error(`Failed to get prompt logs: ${error.message}`);
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(days: number = 7): Promise<any> {
    try {
      const response = await this.client.get(`/admin/analytics/usage?days=${days}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get usage analytics:', error.message);
      throw new Error(`Failed to get usage analytics: ${error.message}`);
    }
  }
}

// Export singleton instance
export const pythonAI = new PythonAIClient();