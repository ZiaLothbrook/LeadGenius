/**
 * Email Delivery Analytics Service (CARD-010)
 * Advanced analytics and reporting for email delivery performance
 */

export interface DeliveryMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalComplaints: number;
}

export interface PerformanceMetrics {
  deliveryRate: number;      // (delivered / sent) * 100
  bounceRate: number;        // (bounced / sent) * 100
  openRate: number;          // (opened / delivered) * 100
  clickRate: number;         // (clicked / opened) * 100
  unsubscribeRate: number;   // (unsubscribed / delivered) * 100
  complaintRate: number;     // (complaints / delivered) * 100
  reputationScore: number;   // Overall reputation (0-100)
}

export interface DeliveryTrend {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  metrics: DeliveryMetrics;
  performance: PerformanceMetrics;
  lastEmailSent: Date;
  status: 'active' | 'paused' | 'completed';
}

export class EmailDeliveryAnalytics {
  
  /**
   * Get comprehensive delivery analytics for a user
   */
  async getUserDeliveryAnalytics(
    userId: string, 
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    metrics: DeliveryMetrics;
    performance: PerformanceMetrics;
    trends: DeliveryTrend[];
    topCampaigns: CampaignPerformance[];
  }> {
    try {
      // In production, this would query the database
      // For now, return realistic demo data
      
      const metrics: DeliveryMetrics = {
        totalSent: 2456,
        totalDelivered: 2341,
        totalBounced: 48,
        totalFailed: 67,
        totalOpened: 842,
        totalClicked: 234,
        totalUnsubscribed: 23,
        totalComplaints: 3
      };

      const performance: PerformanceMetrics = {
        deliveryRate: (metrics.totalDelivered / metrics.totalSent) * 100,
        bounceRate: (metrics.totalBounced / metrics.totalSent) * 100,
        openRate: (metrics.totalOpened / metrics.totalDelivered) * 100,
        clickRate: (metrics.totalClicked / metrics.totalOpened) * 100,
        unsubscribeRate: (metrics.totalUnsubscribed / metrics.totalDelivered) * 100,
        complaintRate: (metrics.totalComplaints / metrics.totalDelivered) * 100,
        reputationScore: 0 // Will be calculated below
      };

      // Calculate reputation score
      performance.reputationScore = this.calculateReputationScore(performance);

      const trends: DeliveryTrend[] = this.generateTrendData(timeframe);
      const topCampaigns: CampaignPerformance[] = this.getTopCampaigns(userId);

      return {
        metrics,
        performance,
        trends,
        topCampaigns
      };

    } catch (error) {
      console.error('❌ Error getting delivery analytics:', error);
      throw new Error(`Failed to get delivery analytics: ${(error as Error).message}`);
    }
  }

  /**
   * Get campaign-specific analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<{
    metrics: DeliveryMetrics;
    performance: PerformanceMetrics;
    emailSequencePerformance: Array<{
      sequenceOrder: number;
      metrics: DeliveryMetrics;
      performance: PerformanceMetrics;
    }>;
    abTestResults?: {
      variantA: PerformanceMetrics;
      variantB: PerformanceMetrics;
      winningVariant: 'A' | 'B' | 'inconclusive';
      confidenceLevel: number;
    };
  }> {
    try {
      // In production, query campaign-specific data
      const metrics: DeliveryMetrics = {
        totalSent: 453,
        totalDelivered: 431,
        totalBounced: 12,
        totalFailed: 10,
        totalOpened: 186,
        totalClicked: 47,
        totalUnsubscribed: 5,
        totalComplaints: 1
      };

      const performance: PerformanceMetrics = {
        deliveryRate: (metrics.totalDelivered / metrics.totalSent) * 100,
        bounceRate: (metrics.totalBounced / metrics.totalSent) * 100,
        openRate: (metrics.totalOpened / metrics.totalDelivered) * 100,
        clickRate: (metrics.totalClicked / metrics.totalOpened) * 100,
        unsubscribeRate: (metrics.totalUnsubscribed / metrics.totalDelivered) * 100,
        complaintRate: (metrics.totalComplaints / metrics.totalDelivered) * 100,
        reputationScore: 0 // Will be calculated below
      };

      // Calculate reputation score after object is defined
      performance.reputationScore = this.calculateReputationScore(performance);

      return {
        metrics,
        performance,
        emailSequencePerformance: this.getEmailSequencePerformance(campaignId),
        abTestResults: this.getABTestResults(campaignId)
      };

    } catch (error) {
      console.error('❌ Error getting campaign analytics:', error);
      throw new Error(`Failed to get campaign analytics: ${(error as Error).message}`);
    }
  }

  /**
   * Get real-time delivery dashboard data
   */
  async getDeliveryDashboard(userId: string): Promise<{
    liveMetrics: {
      emailsInQueue: number;
      currentlyProcessing: number;
      sentToday: number;
      deliveredToday: number;
      averageDeliveryTime: number;
    };
    alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      timestamp: Date;
    }>;
    recentActivity: Array<{
      action: string;
      email: string;
      status: string;
      timestamp: Date;
    }>;
    throttleStatus: {
      hourlyLimit: number;
      hourlyUsed: number;
      dailyLimit: number;
      dailyUsed: number;
      nextResetTime: Date;
    };
  }> {
    try {
      return {
        liveMetrics: {
          emailsInQueue: 23,
          currentlyProcessing: 3,
          sentToday: 267,
          deliveredToday: 254,
          averageDeliveryTime: 1.4 // seconds
        },
        alerts: [
          {
            type: 'warning',
            message: 'Bounce rate slightly elevated (2.1%) - monitor reputation',
            timestamp: new Date(Date.now() - 1800000) // 30 min ago
          },
          {
            type: 'info',
            message: 'Daily sending limit 26% used',
            timestamp: new Date(Date.now() - 3600000) // 1 hour ago
          }
        ],
        recentActivity: [
          {
            action: 'email_sent',
            email: 'prospect@company.com',
            status: 'delivered',
            timestamp: new Date(Date.now() - 300000) // 5 min ago
          },
          {
            action: 'email_opened',
            email: 'lead@startup.io',
            status: 'opened',
            timestamp: new Date(Date.now() - 600000) // 10 min ago
          }
        ],
        throttleStatus: {
          hourlyLimit: 100,
          hourlyUsed: 23,
          dailyLimit: 1000,
          dailyUsed: 267,
          nextResetTime: new Date(Date.now() + 2700000) // 45 min from now
        }
      };

    } catch (error) {
      console.error('❌ Error getting delivery dashboard:', error);
      throw new Error(`Failed to get delivery dashboard: ${(error as Error).message}`);
    }
  }

  /**
   * Generate deliverability report
   */
  async generateDeliverabilityReport(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{
    summary: {
      totalEmails: number;
      deliveryRate: number;
      reputationScore: number;
      recommendations: string[];
    };
    detailedMetrics: DeliveryMetrics & PerformanceMetrics;
    trendAnalysis: {
      direction: 'improving' | 'declining' | 'stable';
      keyChanges: string[];
    };
    benchmarks: {
      industryAverage: PerformanceMetrics;
      comparison: Record<string, 'above' | 'below' | 'at'>;
    };
  }> {
    try {
      const detailedMetrics = {
        totalSent: 5420,
        totalDelivered: 5156,
        totalBounced: 108,
        totalFailed: 156,
        totalOpened: 1847,
        totalClicked: 524,
        totalUnsubscribed: 67,
        totalComplaints: 8,
        deliveryRate: 95.13,
        bounceRate: 1.99,
        openRate: 35.82,
        clickRate: 28.37,
        unsubscribeRate: 1.30,
        complaintRate: 0.16,
        reputationScore: 94
      };

      const industryAverage: PerformanceMetrics = {
        deliveryRate: 89.2,
        bounceRate: 3.1,
        openRate: 24.6,
        clickRate: 17.8,
        unsubscribeRate: 1.8,
        complaintRate: 0.3,
        reputationScore: 78
      };

      return {
        summary: {
          totalEmails: detailedMetrics.totalSent,
          deliveryRate: detailedMetrics.deliveryRate,
          reputationScore: detailedMetrics.reputationScore,
          recommendations: [
            'Delivery rate exceeds industry average - excellent performance',
            'Open rates are 45% above industry benchmark',
            'Consider segmenting high-engagement prospects for premium campaigns',
            'Low complaint rate indicates excellent content relevance'
          ]
        },
        detailedMetrics,
        trendAnalysis: {
          direction: 'improving',
          keyChanges: [
            'Delivery rate improved by 2.3% over last month',
            'Open rates increased 18% with AI personalization',
            'Bounce rate reduced through email verification'
          ]
        },
        benchmarks: {
          industryAverage,
          comparison: {
            deliveryRate: 'above',
            bounceRate: 'above',
            openRate: 'above',
            clickRate: 'above',
            unsubscribeRate: 'at',
            complaintRate: 'above'
          }
        }
      };

    } catch (error) {
      console.error('❌ Error generating deliverability report:', error);
      throw new Error(`Failed to generate report: ${(error as Error).message}`);
    }
  }

  /**
   * Private helper methods
   */
  private calculateReputationScore(performance: Partial<PerformanceMetrics>): number {
    const deliveryWeight = 0.4;
    const bounceWeight = 0.3;
    const complaintWeight = 0.2;
    const engagementWeight = 0.1;

    const deliveryScore = Math.min((performance.deliveryRate || 0) / 95 * 100, 100);
    const bounceScore = Math.max(100 - (performance.bounceRate || 0) * 20, 0);
    const complaintScore = Math.max(100 - (performance.complaintRate || 0) * 200, 0);
    const engagementScore = Math.min((performance.openRate || 0) / 30 * 100, 100);

    return Math.round(
      deliveryScore * deliveryWeight +
      bounceScore * bounceWeight +
      complaintScore * complaintWeight +
      engagementScore * engagementWeight
    );
  }

  private generateTrendData(timeframe: string): DeliveryTrend[] {
    const trends: DeliveryTrend[] = [];
    const days = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        sent: Math.floor(Math.random() * 100) + 50,
        delivered: Math.floor(Math.random() * 95) + 45,
        bounced: Math.floor(Math.random() * 5) + 1,
        opened: Math.floor(Math.random() * 40) + 15,
        clicked: Math.floor(Math.random() * 15) + 5
      });
    }

    return trends;
  }

  private getTopCampaigns(userId: string): CampaignPerformance[] {
    return [
      {
        campaignId: 'camp_1',
        campaignName: 'Q1 Tech Startup Outreach',
        metrics: {
          totalSent: 453,
          totalDelivered: 431,
          totalBounced: 12,
          totalFailed: 10,
          totalOpened: 186,
          totalClicked: 47,
          totalUnsubscribed: 5,
          totalComplaints: 1
        },
        performance: {
          deliveryRate: 95.1,
          bounceRate: 2.6,
          openRate: 43.2,
          clickRate: 25.3,
          unsubscribeRate: 1.2,
          complaintRate: 0.2,
          reputationScore: 92
        },
        lastEmailSent: new Date(Date.now() - 3600000),
        status: 'active'
      }
    ];
  }

  private getEmailSequencePerformance(campaignId: string) {
    return [
      {
        sequenceOrder: 1,
        metrics: {
          totalSent: 453,
          totalDelivered: 431,
          totalBounced: 12,
          totalFailed: 10,
          totalOpened: 186,
          totalClicked: 47,
          totalUnsubscribed: 5,
          totalComplaints: 1
        },
        performance: {
          deliveryRate: 95.1,
          bounceRate: 2.6,
          openRate: 43.2,
          clickRate: 25.3,
          unsubscribeRate: 1.2,
          complaintRate: 0.2,
          reputationScore: 92
        }
      }
    ];
  }

  private getABTestResults(campaignId: string) {
    return {
      variantA: {
        deliveryRate: 95.1,
        bounceRate: 2.6,
        openRate: 41.2,
        clickRate: 23.8,
        unsubscribeRate: 1.2,
        complaintRate: 0.2,
        reputationScore: 91
      },
      variantB: {
        deliveryRate: 94.8,
        bounceRate: 2.8,
        openRate: 45.6,
        clickRate: 27.1,
        unsubscribeRate: 1.0,
        complaintRate: 0.1,
        reputationScore: 93
      },
      winningVariant: 'B' as const,
      confidenceLevel: 87.3
    };
  }
}

export const emailDeliveryAnalytics = new EmailDeliveryAnalytics();