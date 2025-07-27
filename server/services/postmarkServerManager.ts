import * as postmark from 'postmark';
import { storage } from '../storage';

export interface PostmarkServerConfig {
  id: number;
  name: string;
  apiToken: string;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'turquoise' | 'orange' | 'grey';
  rawEmailEnabled: boolean;
  deliveryHookUrl?: string;
  inboundHookUrl?: string;
  bounceHookUrl?: string;
  includeBounceContentInHook?: boolean;
  openHookUrl?: string;
  postFirstOpenOnly?: boolean;
  trackOpens?: boolean;
  trackLinks?: 'None' | 'HtmlAndText' | 'HtmlOnly' | 'TextOnly';
  clickHookUrl?: string;
  deliveryDelayHookUrl?: string;
}

export interface CreateServerRequest {
  name: string;
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'turquoise' | 'orange' | 'grey';
  rawEmailEnabled?: boolean;
  smtpApiActivated?: boolean;
  deliveryHookUrl?: string;
  inboundHookUrl?: string;
  bounceHookUrl?: string;
  includeBounceContentInHook?: boolean;
  openHookUrl?: string;
  postFirstOpenOnly?: boolean;
  trackOpens?: boolean;
  trackLinks?: 'None' | 'HtmlAndText' | 'HtmlOnly' | 'TextOnly';
  clickHookUrl?: string;
  deliveryDelayHookUrl?: string;
}

export interface ServerCreationResult {
  success: boolean;
  server?: PostmarkServerConfig;
  error?: string;
  userId?: string;
}

class PostmarkServerManager {
  private accountClient: postmark.AccountClient | null = null;
  private accountApiKey: string | undefined;

  constructor() {
    this.accountApiKey = process.env.POSTMARK_SERVER_API;

    if (this.accountApiKey) {
      this.accountClient = new postmark.AccountClient(this.accountApiKey);
      console.log('✅ Postmark Account API initialized for dynamic server creation');
    } else {
      console.warn('⚠️  POSTMARK_SERVER_API not configured - dynamic server creation disabled');
    }
  }

  /**
   * Create a new Postmark server for a user
   */
  async createServerForUser(userId: string, serverRequest: CreateServerRequest): Promise<ServerCreationResult> {
    if (!this.accountClient) {
      return {
        success: false,
        error: 'Postmark Account API not configured',
        userId
      };
    }

    try {
      console.log(`🚀 Creating Postmark server for user ${userId}:`, serverRequest.name);

      // Check if user already has a server
      const existingUser = await storage.getUser(userId);
      if (existingUser?.postmarkServerId) {
        return {
          success: false,
          error: 'User already has a Postmark server configured',
          userId
        };
      }

      // Create the server via Postmark Account API
      const serverData: postmark.Models.CreateServerRequest = {
        Name: serverRequest.name,
        Color: serverRequest.color || 'blue',
        RawEmailEnabled: serverRequest.rawEmailEnabled || false,
        SmtpApiActivated: serverRequest.smtpApiActivated || true,
        DeliveryHookUrl: serverRequest.deliveryHookUrl,
        InboundHookUrl: serverRequest.inboundHookUrl,
        BounceHookUrl: serverRequest.bounceHookUrl,
        IncludeBounceContentInHook: serverRequest.includeBounceContentInHook || false,
        OpenHookUrl: serverRequest.openHookUrl,
        PostFirstOpenOnly: serverRequest.postFirstOpenOnly || false,
        TrackOpens: serverRequest.trackOpens !== false,
        TrackLinks: serverRequest.trackLinks || 'HtmlAndText',
        ClickHookUrl: serverRequest.clickHookUrl,
        DeliveryDelayHookUrl: serverRequest.deliveryDelayHookUrl,
      };

      const response = await this.accountClient.createServer(serverData);
      
      console.log(`✅ Postmark server created successfully:`, {
        id: response.ID,
        name: response.Name,
        token: response.ApiTokens[0]?.substring(0, 8) + '...'
      });

      // Extract the server API token (first token is typically the default one)
      const serverApiToken = response.ApiTokens[0];
      if (!serverApiToken) {
        throw new Error('No API token returned from server creation');
      }

      // Update user with server information
      await storage.updateUser(userId, {
        postmarkServerId: response.ID.toString(),
        postmarkServerToken: serverApiToken,
        postmarkServerName: response.Name,
        postmarkServerCreatedAt: new Date(),
        updatedAt: new Date(),
      });

      const serverConfig: PostmarkServerConfig = {
        id: response.ID,
        name: response.Name,
        apiToken: serverApiToken,
        color: response.Color as any,
        rawEmailEnabled: response.RawEmailEnabled,
        deliveryHookUrl: response.DeliveryHookUrl,
        inboundHookUrl: response.InboundHookUrl,
        bounceHookUrl: response.BounceHookUrl,
        includeBounceContentInHook: response.IncludeBounceContentInHook,
        openHookUrl: response.OpenHookUrl,
        postFirstOpenOnly: response.PostFirstOpenOnly,
        trackOpens: response.TrackOpens,
        trackLinks: response.TrackLinks as any,
        clickHookUrl: response.ClickHookUrl,
        deliveryDelayHookUrl: response.DeliveryDelayHookUrl,
      };

      return {
        success: true,
        server: serverConfig,
        userId
      };

    } catch (error) {
      console.error(`❌ Failed to create Postmark server for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        userId
      };
    }
  }

  /**
   * Get user's server configuration
   */
  async getUserServerConfig(userId: string): Promise<PostmarkServerConfig | null> {
    const user = await storage.getUser(userId);
    
    if (!user?.postmarkServerId || !user?.postmarkServerToken) {
      return null;
    }

    return {
      id: parseInt(user.postmarkServerId),
      name: user.postmarkServerName || 'Unknown Server',
      apiToken: user.postmarkServerToken,
      color: 'blue', // Default color, could be stored in DB if needed
      rawEmailEnabled: false, // Default value, could be stored in DB if needed
      trackOpens: true,
      trackLinks: 'HtmlAndText',
    };
  }

  /**
   * Update server configuration for a user
   */
  async updateServerConfig(userId: string, updates: Partial<CreateServerRequest>): Promise<ServerCreationResult> {
    if (!this.accountClient) {
      return {
        success: false,
        error: 'Postmark Account API not configured',
        userId
      };
    }

    try {
      const user = await storage.getUser(userId);
      if (!user?.postmarkServerId) {
        return {
          success: false,
          error: 'User does not have a Postmark server configured',
          userId
        };
      }

      const serverId = parseInt(user.postmarkServerId);
      
      // Update server via Postmark API
      const updateData: Partial<postmark.Models.UpdateServerRequest> = {};
      if (updates.name) updateData.Name = updates.name;
      if (updates.color) updateData.Color = updates.color;
      if (updates.deliveryHookUrl !== undefined) updateData.DeliveryHookUrl = updates.deliveryHookUrl;
      if (updates.inboundHookUrl !== undefined) updateData.InboundHookUrl = updates.inboundHookUrl;
      if (updates.bounceHookUrl !== undefined) updateData.BounceHookUrl = updates.bounceHookUrl;
      if (updates.openHookUrl !== undefined) updateData.OpenHookUrl = updates.openHookUrl;
      if (updates.trackOpens !== undefined) updateData.TrackOpens = updates.trackOpens;
      if (updates.trackLinks !== undefined) updateData.TrackLinks = updates.trackLinks;

      const response = await this.accountClient.editServer(serverId, updateData);
      
      // Update user database record
      const userUpdates: any = {};
      if (updates.name) userUpdates.postmarkServerName = updates.name;
      userUpdates.updatedAt = new Date();
      
      await storage.updateUser(userId, userUpdates);

      console.log(`✅ Postmark server updated for user ${userId}:`, {
        id: response.ID,
        name: response.Name
      });

      return {
        success: true,
        userId
      };

    } catch (error) {
      console.error(`❌ Failed to update Postmark server for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        userId
      };
    }
  }

  /**
   * Delete a user's server (use with caution!)
   */
  async deleteUserServer(userId: string): Promise<ServerCreationResult> {
    if (!this.accountClient) {
      return {
        success: false,
        error: 'Postmark Account API not configured',
        userId
      };
    }

    try {
      const user = await storage.getUser(userId);
      if (!user?.postmarkServerId) {
        return {
          success: false,
          error: 'User does not have a Postmark server configured',
          userId
        };
      }

      const serverId = parseInt(user.postmarkServerId);
      
      // Delete server via Postmark API
      await this.accountClient.deleteServer(serverId);
      
      // Clear server information from user record
      await storage.updateUser(userId, {
        postmarkServerId: null,
        postmarkServerToken: null,
        postmarkServerName: null,
        postmarkFromEmail: null,
        postmarkFromName: null,
        postmarkServerCreatedAt: null,
        updatedAt: new Date(),
      });

      console.log(`✅ Postmark server deleted for user ${userId}:`, { serverId });

      return {
        success: true,
        userId
      };

    } catch (error) {
      console.error(`❌ Failed to delete Postmark server for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        userId
      };
    }
  }

  /**
   * Auto-create server for new users
   */
  async autoCreateServerForUser(userId: string, userEmail?: string): Promise<ServerCreationResult> {
    const user = await storage.getUser(userId);
    const userName = user?.username || user?.firstName || 'User';
    const serverName = `${userName} Lead Generation Server`;

    return this.createServerForUser(userId, {
      name: serverName,
      color: 'blue',
      trackOpens: true,
      trackLinks: 'HtmlAndText',
      rawEmailEnabled: false,
    });
  }

  /**
   * Health check for Account API
   */
  async healthCheck(): Promise<boolean> {
    if (!this.accountClient) {
      return false;
    }

    try {
      // Try to get account info as a health check
      await this.accountClient.getAccount();
      return true;
    } catch (error) {
      console.error('Postmark Account API health check failed:', error);
      return false;
    }
  }

  /**
   * Get configuration status
   */
  getConfiguration() {
    return {
      configured: !!this.accountApiKey,
      accountApiAvailable: !!this.accountClient,
      capabilities: {
        createServers: !!this.accountClient,
        manageServers: !!this.accountClient,
        deleteServers: !!this.accountClient,
      }
    };
  }
}

export const postmarkServerManager = new PostmarkServerManager();