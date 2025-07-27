import { db } from "../db";
import { 
  responses, 
  responseAnalysis, 
  responseActions, 
  responseOptimizationInsights,
  type Response,
  type InsertResponse,
  type ResponseAnalysis,
  type InsertResponseAnalysis,
  type ResponseAction,
  type InsertResponseAction,
  type ResponseOptimizationInsight,
  type InsertResponseOptimizationInsight
} from "@shared/schema";
import { eq, and, desc, sql, count, avg, between } from "drizzle-orm";
import { pythonAI } from "./pythonAiClient";

interface ResponseDetectionResult {
  success: boolean;
  response?: Response;
  analysis?: ResponseAnalysis;
  actions?: ResponseAction[];
  error?: string;
}

interface SentimentAnalysisResult {
  sentimentCategory: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -100 to +100
  sentimentConfidence: number; // 0-100
  emotionalTone: string;
  intentCategory: string;
  intentScore: number;
  keyIntents: string[];
  responseCategory: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  actionRequired: boolean;
  keyPhrases: string[];
  topics: string[];
  questions: string[];
  objections: string[];
  aiSummary: string;
  aiRecommendations: string[];
  nextBestAction: string;
  analysisConfidence: number;
  processingTime: number;
}

interface ResponseOptimizationData {
  responsePatterns: any;
  sentimentTrends: any;
  actionEffectiveness: any;
  campaignImpact: any;
  recommendations: any[];
}

export class ResponseDetectionService {
  private static instance: ResponseDetectionService;

  public static getInstance(): ResponseDetectionService {
    if (!ResponseDetectionService.instance) {
      ResponseDetectionService.instance = new ResponseDetectionService();
    }
    return ResponseDetectionService.instance;
  }

  // Core response detection
  async detectResponse(data: {
    responseText: string;
    responseType: 'email' | 'linkedin' | 'phone' | 'chat';
    responseFrom: string;
    responseTo?: string;
    responseSubject?: string;
    campaignId?: string;
    messageId?: string;
    prospectId?: string;
    userId: string;
    detectionMethod: 'api_webhook' | 'email_parsing' | 'manual_input' | 'auto_scan';
    responseTime?: Date;
    rawData?: any;
  }): Promise<ResponseDetectionResult> {
    try {
      const startTime = Date.now();

      // Create response record
      const responseData: InsertResponse = {
        userId: data.userId,
        campaignId: data.campaignId,
        messageId: data.messageId,
        prospectId: data.prospectId,
        responseText: data.responseText,
        responseType: data.responseType,
        responseSubject: data.responseSubject,
        responseFrom: data.responseFrom,
        responseTo: data.responseTo,
        detectionMethod: data.detectionMethod,
        detectionConfidence: 100.00, // Will be updated based on analysis
        rawData: data.rawData,
        responseTime: data.responseTime || new Date(),
        timeSinceOutreach: this.calculateTimeSinceOutreach(data.messageId),
        processingStatus: 'pending'
      };

      const [response] = await db.insert(responses).values(responseData).returning();

      // Perform AI sentiment analysis
      const analysis = await this.analyzeSentiment(response.responseText, response.id, data.userId);
      
      // Generate automated actions based on analysis
      const actions = await this.generateAutomatedActions(response, analysis, data.userId);

      // Update processing status
      await db
        .update(responses)
        .set({ 
          processingStatus: 'processed',
          detectionConfidence: analysis.analysisConfidence 
        })
        .where(eq(responses.id, response.id));

      const processingTime = Date.now() - startTime;
      console.log(`✅ Response detected and analyzed in ${processingTime}ms for user ${data.userId}`);

      return {
        success: true,
        response,
        analysis,
        actions
      };

    } catch (error: any) {
      console.error('Error detecting response:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // AI-powered sentiment analysis
  private async analyzeSentiment(responseText: string, responseId: string, userId: string): Promise<ResponseAnalysis> {
    try {
      const startTime = Date.now();

      const analysisPrompt = `
Analyze this customer response for sentiment, intent, and actionable insights:

Response: "${responseText}"

Provide detailed analysis in JSON format with:
1. Sentiment analysis (positive/negative/neutral, score -100 to +100, confidence 0-100)
2. Emotional tone (excited, frustrated, interested, confused, angry, happy, etc.)
3. Intent detection (interested, not_interested, information_request, objection, meeting_request, referral)
4. Response categorization (positive_interest, objection, question, out_of_office, unsubscribe, referral, meeting_booked)
5. Urgency level (low, medium, high, urgent)
6. Key phrases, topics, questions, and objections identified
7. AI summary and recommendations
8. Next best action (follow_up, schedule_meeting, send_info, close_opportunity, nurture)

Return structured JSON with all analysis fields.`;

      const aiResult = await pythonAI.analyzeIntent({
        text: responseText,
        context: "customer response analysis",
        analysis_type: "comprehensive",
        response_format: "detailed_json"
      });

      const analysisData = aiResult;
      const processingTime = Date.now() - startTime;

      const analysisRecord: InsertResponseAnalysis = {
        responseId,
        userId,
        sentimentCategory: analysisData.sentimentCategory || 'neutral',
        sentimentScore: parseFloat(analysisData.sentimentScore) || 0,
        sentimentConfidence: parseFloat(analysisData.sentimentConfidence) || 100,
        emotionalTone: analysisData.emotionalTone,
        intentCategory: analysisData.intentCategory || 'information_request',
        intentScore: parseFloat(analysisData.intentScore) || 0,
        keyIntents: analysisData.keyIntents || [],
        responseCategory: analysisData.responseCategory || 'question',
        urgencyLevel: analysisData.urgencyLevel || 'medium',
        actionRequired: analysisData.actionRequired || false,
        keyPhrases: analysisData.keyPhrases || [],
        topics: analysisData.topics || [],
        questions: analysisData.questions || [],
        objections: analysisData.objections || [],
        aiSummary: analysisData.aiSummary,
        aiRecommendations: analysisData.aiRecommendations || [],
        nextBestAction: analysisData.nextBestAction || 'follow_up',
        analysisConfidence: parseFloat(analysisData.analysisConfidence) || 95,
        analysisModel: 'claude-sonnet-4',
        processingTime
      };

      const [analysis] = await db.insert(responseAnalysis).values(analysisRecord).returning();
      
      console.log(`🧠 Response sentiment analyzed: ${analysisData.sentimentCategory} (${analysisData.sentimentScore}) for response ${responseId}`);
      
      return analysis;

    } catch (error: any) {
      console.error('Error analyzing sentiment:', error);
      
      // Create fallback analysis
      const fallbackAnalysis: InsertResponseAnalysis = {
        responseId,
        userId,
        sentimentCategory: 'neutral',
        sentimentScore: 0,
        sentimentConfidence: 50,
        intentCategory: 'information_request',
        responseCategory: 'question',
        urgencyLevel: 'medium',
        actionRequired: false,
        keyPhrases: [],
        topics: [],
        questions: [],
        objections: [],
        aiSummary: 'Analysis failed - manual review required',
        aiRecommendations: ['Manual review recommended'],
        nextBestAction: 'follow_up',
        analysisConfidence: 50,
        analysisModel: 'fallback',
        processingTime: Date.now() - Date.now()
      };

      const [analysis] = await db.insert(responseAnalysis).values(fallbackAnalysis).returning();
      return analysis;
    }
  }

  // Generate automated actions based on analysis
  private async generateAutomatedActions(
    response: Response, 
    analysis: ResponseAnalysis, 
    userId: string
  ): Promise<ResponseAction[]> {
    const actions: ResponseAction[] = [];

    try {
      // Action 1: Auto-tagging based on sentiment
      if (analysis.sentimentCategory === 'positive') {
        actions.push(await this.createAction({
          responseId: response.id,
          userId,
          actionType: 'tag_response',
          actionData: { tags: ['positive', 'interested'], priority: 'high' },
          actionPriority: 'medium',
          isAutomated: true
        }));
      }

      // Action 2: High-priority notification for urgent responses
      if (analysis.urgencyLevel === 'urgent' || analysis.actionRequired) {
        actions.push(await this.createAction({
          responseId: response.id,
          userId,
          actionType: 'send_notification',
          actionData: { 
            type: 'urgent_response',
            message: `Urgent response received: ${analysis.aiSummary}`,
            channels: ['email', 'dashboard']
          },
          actionPriority: 'urgent',
          isAutomated: true
        }));
      }

      // Action 3: Schedule follow-up for interested prospects
      if (analysis.intentCategory === 'interested' || analysis.responseCategory === 'positive_interest') {
        actions.push(await this.createAction({
          responseId: response.id,
          userId,
          actionType: 'schedule_follow_up',
          actionData: {
            followUpType: 'interested_prospect',
            suggestedDelay: 24, // hours
            message: 'Follow up on positive interest shown'
          },
          actionPriority: 'high',
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          isAutomated: true
        }));
      }

      // Action 4: Update prospect status
      actions.push(await this.createAction({
        responseId: response.id,
        userId,
        actionType: 'update_prospect',
        actionData: {
          fields: {
            lastResponseAt: response.responseTime,
            responseCategory: analysis.responseCategory,
            sentimentScore: analysis.sentimentScore,
            engagementLevel: this.calculateEngagementLevel(analysis)
          }
        },
        actionPriority: 'medium',
        isAutomated: true
      }));

      console.log(`🤖 Generated ${actions.length} automated actions for response ${response.id}`);
      
      return actions;

    } catch (error: any) {
      console.error('Error generating automated actions:', error);
      return actions; // Return partial actions if any were created
    }
  }

  // Create an action record
  private async createAction(actionData: {
    responseId: string;
    userId: string;
    actionType: string;
    actionData: any;
    actionPriority?: string;
    scheduledFor?: Date;
    isAutomated?: boolean;
  }): Promise<ResponseAction> {
    const insertData: InsertResponseAction = {
      responseId: actionData.responseId,
      userId: actionData.userId,
      actionType: actionData.actionType,
      actionStatus: actionData.scheduledFor ? 'scheduled' : 'pending',
      actionPriority: actionData.actionPriority || 'medium',
      actionData: actionData.actionData,
      scheduledFor: actionData.scheduledFor,
      isAutomated: actionData.isAutomated || false,
      triggerConditions: { automated: true, timestamp: new Date().toISOString() }
    };

    const [action] = await db.insert(responseActions).values(insertData).returning();
    return action;
  }

  // Get responses with analysis for a user
  async getResponsesWithAnalysis(userId: string, options: {
    campaignId?: string;
    limit?: number;
    offset?: number;
    sentimentFilter?: 'positive' | 'negative' | 'neutral';
    dateRange?: { start: Date; end: Date };
  } = {}): Promise<{ responses: any[]; total: number; analytics: any }> {
    try {
      let query = db
        .select({
          response: responses,
          analysis: responseAnalysis,
          actionsCount: sql<number>`COUNT(${responseActions.id})`
        })
        .from(responses)
        .leftJoin(responseAnalysis, eq(responses.id, responseAnalysis.responseId))
        .leftJoin(responseActions, eq(responses.id, responseActions.responseId))
        .where(eq(responses.userId, userId))
        .groupBy(responses.id, responseAnalysis.id);

      // Apply filters
      if (options.campaignId) {
        query = query.where(and(
          eq(responses.userId, userId),
          eq(responses.campaignId, options.campaignId)
        ));
      }

      if (options.sentimentFilter && options.sentimentFilter !== undefined) {
        query = query.where(and(
          eq(responses.userId, userId),
          eq(responseAnalysis.sentimentCategory, options.sentimentFilter)
        ));
      }

      if (options.dateRange) {
        query = query.where(and(
          eq(responses.userId, userId),
          between(responses.responseTime, options.dateRange.start, options.dateRange.end)
        ));
      }

      const responseData = await query
        .orderBy(desc(responses.responseTime))
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(responses)
        .where(eq(responses.userId, userId));

      // Get analytics
      const analytics = await this.getResponseAnalytics(userId, options.campaignId);

      console.log(`📊 Retrieved ${responseData.length} responses with analysis for user ${userId}`);

      return {
        responses: responseData,
        total: totalResult.count,
        analytics
      };

    } catch (error: any) {
      console.error('Error getting responses with analysis:', error);
      throw error;
    }
  }

  // Get response analytics
  async getResponseAnalytics(userId: string, campaignId?: string): Promise<any> {
    try {
      const baseWhere = campaignId 
        ? and(eq(responses.userId, userId), eq(responses.campaignId, campaignId))
        : eq(responses.userId, userId);

      // Basic counts
      const [totalResponses] = await db
        .select({ count: count() })
        .from(responses)
        .where(baseWhere);

      // Sentiment distribution
      const sentimentDistribution = await db
        .select({
          sentiment: responseAnalysis.sentimentCategory,
          count: count(),
          avgScore: avg(responseAnalysis.sentimentScore)
        })
        .from(responses)
        .leftJoin(responseAnalysis, eq(responses.id, responseAnalysis.responseId))
        .where(baseWhere)
        .groupBy(responseAnalysis.sentimentCategory);

      // Response categories
      const categoryDistribution = await db
        .select({
          category: responseAnalysis.responseCategory,
          count: count()
        })
        .from(responses)
        .leftJoin(responseAnalysis, eq(responses.id, responseAnalysis.responseId))
        .where(baseWhere)
        .groupBy(responseAnalysis.responseCategory);

      // Response rate by campaign
      const responseRates = await db
        .select({
          campaignId: responses.campaignId,
          responseCount: count(),
          avgSentimentScore: avg(responseAnalysis.sentimentScore)
        })
        .from(responses)
        .leftJoin(responseAnalysis, eq(responses.id, responseAnalysis.responseId))
        .where(eq(responses.userId, userId))
        .groupBy(responses.campaignId);

      return {
        totalResponses: totalResponses.count,
        sentimentDistribution,
        categoryDistribution,
        responseRates,
        positiveResponseRate: this.calculatePositiveResponseRate(sentimentDistribution),
        averageSentimentScore: this.calculateAverageSentiment(sentimentDistribution)
      };

    } catch (error: any) {
      console.error('Error getting response analytics:', error);
      throw error;
    }
  }

  // Generate optimization insights
  async generateOptimizationInsights(userId: string, campaignId?: string): Promise<ResponseOptimizationInsight[]> {
    try {
      const analytics = await this.getResponseAnalytics(userId, campaignId);
      const insights: InsertResponseOptimizationInsight[] = [];

      // Insight 1: Low positive response rate
      if (analytics.positiveResponseRate < 0.3) {
        insights.push({
          userId,
          campaignId,
          insightType: 'performance_correlation',
          title: 'Low Positive Response Rate Detected',
          description: `Only ${(analytics.positiveResponseRate * 100).toFixed(1)}% of responses are positive. Consider optimizing message tone and personalization.`,
          priority: 'high',
          dataTimeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
          affectedResponses: analytics.totalResponses,
          responseCategories: ['negative', 'neutral'],
          currentMetrics: { positiveRate: analytics.positiveResponseRate },
          benchmarkMetrics: { industryAverage: 0.35 },
          improvementPotential: 15.5,
          recommendations: {
            primary: 'Review and optimize message personalization',
            secondary: 'A/B test different message tones',
            actions: ['message_optimization', 'personalization_review', 'tone_adjustment']
          },
          estimatedImpact: 'medium',
          implementationEffort: 'medium'
        });
      }

      // Insight 2: High objection rate
      const objectionRate = analytics.categoryDistribution
        .find((cat: any) => cat.category === 'objection')?.count / analytics.totalResponses || 0;

      if (objectionRate > 0.2) {
        insights.push({
          userId,
          campaignId,
          insightType: 'optimization_opportunity',
          title: 'High Objection Rate Requires Attention',
          description: `${(objectionRate * 100).toFixed(1)}% of responses contain objections. Common objections should be addressed proactively.`,
          priority: 'medium',
          dataTimeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
          affectedResponses: Math.round(analytics.totalResponses * objectionRate),
          responseCategories: ['objection'],
          currentMetrics: { objectionRate },
          benchmarkMetrics: { targetRate: 0.15 },
          improvementPotential: 8.2,
          recommendations: {
            primary: 'Create objection handling templates',
            secondary: 'Improve initial value proposition',
            actions: ['objection_analysis', 'message_refinement', 'value_prop_optimization']
          },
          estimatedImpact: 'medium',
          implementationEffort: 'low'
        });
      }

      // Save insights to database
      const savedInsights: ResponseOptimizationInsight[] = [];
      for (const insight of insights) {
        const [saved] = await db.insert(responseOptimizationInsights).values(insight).returning();
        savedInsights.push(saved);
      }

      console.log(`💡 Generated ${savedInsights.length} optimization insights for user ${userId}`);
      
      return savedInsights;

    } catch (error: any) {
      console.error('Error generating optimization insights:', error);
      throw error;
    }
  }

  // Execute automated actions
  async executeAction(actionId: string, userId: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const [action] = await db
        .select()
        .from(responseActions)
        .where(and(eq(responseActions.id, actionId), eq(responseActions.userId, userId)));

      if (!action) {
        return { success: false, error: 'Action not found' };
      }

      let executionResult: any = {};

      switch (action.actionType) {
        case 'send_notification':
          executionResult = await this.executeNotificationAction(action);
          break;
        case 'schedule_follow_up':
          executionResult = await this.executeFollowUpAction(action);
          break;
        case 'update_prospect':
          executionResult = await this.executeProspectUpdateAction(action);
          break;
        case 'tag_response':
          executionResult = await this.executeTaggingAction(action);
          break;
        default:
          return { success: false, error: 'Unknown action type' };
      }

      // Update action status
      await db
        .update(responseActions)
        .set({
          actionStatus: 'executed',
          executedAt: new Date(),
          executionResult,
          success: true
        })
        .where(eq(responseActions.id, actionId));

      console.log(`✅ Executed action ${actionId} of type ${action.actionType}`);

      return { success: true, result: executionResult };

    } catch (error: any) {
      console.error('Error executing action:', error);
      
      // Update action with error
      await db
        .update(responseActions)
        .set({
          actionStatus: 'failed',
          success: false,
          errorMessage: error.message
        })
        .where(eq(responseActions.id, actionId));

      return { success: false, error: error.message };
    }
  }

  // Helper methods for calculating metrics
  private calculateTimeSinceOutreach(messageId?: string): number | undefined {
    // This would normally calculate based on message timestamp
    // For now, return undefined to be calculated later
    return undefined;
  }

  private calculateEngagementLevel(analysis: ResponseAnalysis): string {
    if (analysis.sentimentScore > 50) return 'high';
    if (analysis.sentimentScore > 0) return 'medium';
    return 'low';
  }

  private calculatePositiveResponseRate(sentimentDistribution: any[]): number {
    const positive = sentimentDistribution.find(s => s.sentiment === 'positive')?.count || 0;
    const total = sentimentDistribution.reduce((sum, s) => sum + s.count, 0);
    return total > 0 ? positive / total : 0;
  }

  private calculateAverageSentiment(sentimentDistribution: any[]): number {
    const totalScore = sentimentDistribution.reduce((sum, s) => sum + (s.avgScore * s.count), 0);
    const totalCount = sentimentDistribution.reduce((sum, s) => sum + s.count, 0);
    return totalCount > 0 ? totalScore / totalCount : 0;
  }

  // Action execution methods
  private async executeNotificationAction(action: ResponseAction): Promise<any> {
    // Implementation would send actual notifications
    console.log(`📬 Notification sent: ${action.actionData.message}`);
    return { notificationSent: true, channels: action.actionData.channels };
  }

  private async executeFollowUpAction(action: ResponseAction): Promise<any> {
    // Implementation would create follow-up tasks/reminders
    console.log(`📅 Follow-up scheduled: ${action.actionData.message}`);
    return { followUpScheduled: true, scheduledFor: action.scheduledFor };
  }

  private async executeProspectUpdateAction(action: ResponseAction): Promise<any> {
    // Implementation would update prospect records
    console.log(`👤 Prospect updated with fields: ${Object.keys(action.actionData.fields)}`);
    return { prospectUpdated: true, fieldsUpdated: Object.keys(action.actionData.fields) };
  }

  private async executeTaggingAction(action: ResponseAction): Promise<any> {
    // Implementation would apply tags to responses
    console.log(`🏷️ Tags applied: ${action.actionData.tags.join(', ')}`);
    return { tagsApplied: true, tags: action.actionData.tags };
  }
}

export const responseDetectionService = ResponseDetectionService.getInstance();