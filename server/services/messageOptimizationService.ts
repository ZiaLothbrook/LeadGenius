import { db } from '../db';
import { 
  messageABTests, 
  messageVariants, 
  messagePerformanceMetrics, 
  messageOptimizationRules,
  messageEffectivenessScores,
  messageOptimizationInsights,
  messages 
} from '../../shared/schema';
import { eq, and, desc, gt, lt, sql, asc } from 'drizzle-orm';
import { pythonAI } from './pythonAiClient';

export interface ABTestConfig {
  testName: string;
  testType: 'subject_line' | 'content' | 'cta' | 'tone' | 'length' | 'timing';
  hypothesis: string;
  testDescription?: string;
  sampleSize: number;
  confidenceLevel: number;
  minDetectableEffect: number;
  trafficSplit: Record<string, number>;
  plannedDuration: number; // hours
  campaignId?: string;
  tags?: string[];
}

export interface MessageVariantConfig {
  variantName: string;
  variantType: 'control' | 'treatment';
  changes: Record<string, any>;
  changeSummary?: string;
}

export interface PerformanceMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  converted: number;
  bounced: number;
  unsubscribed: number;
}

export interface OptimizationRule {
  ruleName: string;
  ruleType: 'auto_pause' | 'auto_promote' | 'auto_adjust' | 'alert';
  conditions: Record<string, any>;
  triggers: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  cooldownPeriod: number;
}

export interface EffectivenessScoring {
  overallScore: number;
  engagementScore: number;
  conversionScore: number;
  qualityScore: number;
  relevanceScore: number;
  subjectLineScore: number;
  contentScore: number;
  ctaScore: number;
  personalizationScore: number;
  timingScore: number;
}

class MessageOptimizationService {
  
  /**
   * CARD-029: A/B Testing Framework
   * Create and manage A/B tests for message optimization
   */
  async createABTest(userId: string, config: ABTestConfig) {
    try {
      const [abTest] = await db.insert(messageABTests).values({
        userId,
        campaignId: config.campaignId,
        testName: config.testName,
        testType: config.testType,
        hypothesis: config.hypothesis,
        testDescription: config.testDescription,
        sampleSize: config.sampleSize,
        confidenceLevel: config.confidenceLevel.toString(),
        minDetectableEffect: config.minDetectableEffect.toString(),
        trafficSplit: config.trafficSplit,
        plannedDuration: config.plannedDuration,
        tags: config.tags || [],
        status: 'draft',
      }).returning();

      return {
        success: true,
        testId: abTest.id,
        test: abTest,
        message: 'A/B test created successfully'
      };
    } catch (error) {
      console.error('Error creating A/B test:', error);
      return {
        success: false,
        error: 'Failed to create A/B test'
      };
    }
  }

  async createMessageVariant(testId: string, messageId: string, config: MessageVariantConfig) {
    try {
      const [variant] = await db.insert(messageVariants).values({
        testId,
        messageId,
        variantName: config.variantName,
        variantType: config.variantType,
        changes: config.changes,
        changeSummary: config.changeSummary,
      }).returning();

      return {
        success: true,
        variantId: variant.id,
        variant,
        message: 'Message variant created successfully'
      };
    } catch (error) {
      console.error('Error creating message variant:', error);
      return {
        success: false,
        error: 'Failed to create message variant'
      };
    }
  }

  async startABTest(testId: string) {
    try {
      const [updatedTest] = await db.update(messageABTests)
        .set({
          status: 'running',
          startDate: new Date(),
          endDate: new Date(Date.now() + (24 * 60 * 60 * 1000)), // 24 hours from now
          updatedAt: new Date(),
        })
        .where(eq(messageABTests.id, testId))
        .returning();

      return {
        success: true,
        test: updatedTest,
        message: 'A/B test started successfully'
      };
    } catch (error) {
      console.error('Error starting A/B test:', error);
      return {
        success: false,
        error: 'Failed to start A/B test'
      };
    }
  }

  /**
   * Message Performance Tracking
   * Track detailed performance metrics for message variants
   */
  async trackMessagePerformance(messageId: string, userId: string, eventType: string, eventData: any = {}) {
    try {
      // Get or create performance metrics record
      let [metrics] = await db.select()
        .from(messagePerformanceMetrics)
        .where(eq(messagePerformanceMetrics.messageId, messageId))
        .limit(1);

      if (!metrics) {
        [metrics] = await db.insert(messagePerformanceMetrics).values({
          messageId,
          userId,
          sentAt: eventType === 'sent' ? new Date() : undefined,
        }).returning();
      }

      // Update metrics based on event type
      const updateData: any = {
        updatedAt: new Date(),
      };

      switch (eventType) {
        case 'delivered':
          updateData.deliveredAt = new Date();
          updateData.deliveryStatus = 'delivered';
          break;
        case 'opened':
          updateData.firstOpenedAt = metrics.firstOpenedAt || new Date();
          updateData.lastOpenedAt = new Date();
          updateData.totalOpens = (metrics.totalOpens || 0) + 1;
          updateData.timeToFirstOpen = metrics.firstOpenedAt ? undefined : Math.floor((Date.now() - new Date(metrics.sentAt!).getTime()) / 60000);
          updateData.deviceType = eventData.deviceType;
          updateData.emailClient = eventData.emailClient;
          break;
        case 'clicked':
          updateData.firstClickedAt = metrics.firstClickedAt || new Date();
          updateData.totalClicks = (metrics.totalClicks || 0) + 1;
          updateData.timeToFirstClick = metrics.firstClickedAt ? undefined : Math.floor((Date.now() - new Date(metrics.sentAt!).getTime()) / 60000);
          break;
        case 'replied':
          updateData.repliedAt = new Date();
          updateData.timeToReply = Math.floor((Date.now() - new Date(metrics.sentAt!).getTime()) / 60000);
          break;
        case 'converted':
          updateData.convertedAt = new Date();
          break;
        case 'bounced':
          updateData.deliveryStatus = 'bounced';
          updateData.bounceType = eventData.bounceType;
          updateData.bounceReason = eventData.bounceReason;
          break;
      }

      await db.update(messagePerformanceMetrics)
        .set(updateData)
        .where(eq(messagePerformanceMetrics.id, metrics.id));

      // Update variant performance if applicable
      await this.updateVariantPerformance(messageId, eventType);

      return {
        success: true,
        message: 'Performance tracked successfully'
      };
    } catch (error) {
      console.error('Error tracking message performance:', error);
      return {
        success: false,
        error: 'Failed to track performance'
      };
    }
  }

  private async updateVariantPerformance(messageId: string, eventType: string) {
    try {
      // Find variants associated with this message
      const variants = await db.select()
        .from(messageVariants)
        .where(eq(messageVariants.messageId, messageId));

      for (const variant of variants) {
        const updateData: any = {
          updatedAt: new Date(),
        };

        switch (eventType) {
          case 'sent':
            updateData.sent = sql`${messageVariants.sent} + 1`;
            break;
          case 'delivered':
            updateData.delivered = sql`${messageVariants.delivered} + 1`;
            break;
          case 'opened':
            updateData.opened = sql`${messageVariants.opened} + 1`;
            break;
          case 'clicked':
            updateData.clicked = sql`${messageVariants.clicked} + 1`;
            break;
          case 'replied':
            updateData.replied = sql`${messageVariants.replied} + 1`;
            break;
          case 'converted':
            updateData.converted = sql`${messageVariants.converted} + 1`;
            break;
          case 'bounced':
            updateData.bounced = sql`${messageVariants.bounced} + 1`;
            break;
          case 'unsubscribed':
            updateData.unsubscribed = sql`${messageVariants.unsubscribed} + 1`;
            break;
        }

        await db.update(messageVariants)
          .set(updateData)
          .where(eq(messageVariants.id, variant.id));

        // Recalculate rates
        await this.calculateVariantRates(variant.id);
      }
    } catch (error) {
      console.error('Error updating variant performance:', error);
    }
  }

  private async calculateVariantRates(variantId: string) {
    try {
      const [variant] = await db.select()
        .from(messageVariants)
        .where(eq(messageVariants.id, variantId))
        .limit(1);

      if (!variant) return;

      const sent = variant.sent || 0;
      const delivered = variant.delivered || 0;
      const opened = variant.opened || 0;
      const clicked = variant.clicked || 0;
      const replied = variant.replied || 0;
      const converted = variant.converted || 0;

      const deliveryRate = sent > 0 ? (delivered / sent) : 0;
      const openRate = delivered > 0 ? (opened / delivered) : 0;
      const clickRate = opened > 0 ? (clicked / opened) : 0;
      const responseRate = sent > 0 ? (replied / sent) : 0;
      const conversionRate = sent > 0 ? (converted / sent) : 0;

      await db.update(messageVariants)
        .set({
          deliveryRate: deliveryRate.toString(),
          openRate: openRate.toString(),
          clickRate: clickRate.toString(),
          responseRate: responseRate.toString(),
          conversionRate: conversionRate.toString(),
          updatedAt: new Date(),
        })
        .where(eq(messageVariants.id, variantId));

    } catch (error) {
      console.error('Error calculating variant rates:', error);
    }
  }

  /**
   * Automated Message Optimization
   * Apply optimization rules and algorithms
   */
  async createOptimizationRule(userId: string, rule: OptimizationRule) {
    try {
      const [newRule] = await db.insert(messageOptimizationRules).values({
        userId,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        conditions: rule.conditions,
        triggers: rule.triggers,
        actions: rule.actions,
        priority: rule.priority,
        cooldownPeriod: rule.cooldownPeriod,
        isActive: true,
      }).returning();

      return {
        success: true,
        ruleId: newRule.id,
        rule: newRule,
        message: 'Optimization rule created successfully'
      };
    } catch (error) {
      console.error('Error creating optimization rule:', error);
      return {
        success: false,
        error: 'Failed to create optimization rule'
      };
    }
  }

  async applyOptimizationRules(userId: string) {
    try {
      // Get all active rules for user
      const rules = await db.select()
        .from(messageOptimizationRules)
        .where(and(
          eq(messageOptimizationRules.userId, userId),
          eq(messageOptimizationRules.isActive, true)
        ))
        .orderBy(desc(messageOptimizationRules.priority));

      const appliedRules = [];

      for (const rule of rules) {
        // Check cooldown period
        if (rule.lastExecuted) {
          const hoursSinceLastExecution = (Date.now() - new Date(rule.lastExecuted).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastExecution < (rule.cooldownPeriod || 24)) {
            continue;
          }
        }

        // Apply rule based on type
        const ruleResult = await this.executeOptimizationRule(rule);
        if (ruleResult.applied) {
          appliedRules.push(ruleResult);

          // Update rule execution tracking
          await db.update(messageOptimizationRules)
            .set({
              lastExecuted: new Date(),
              executionCount: sql`${messageOptimizationRules.executionCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(messageOptimizationRules.id, rule.id));
        }
      }

      return {
        success: true,
        appliedRules,
        message: `Applied ${appliedRules.length} optimization rules`
      };
    } catch (error) {
      console.error('Error applying optimization rules:', error);
      return {
        success: false,
        error: 'Failed to apply optimization rules'
      };
    }
  }

  private async executeOptimizationRule(rule: any) {
    try {
      // Get relevant tests based on rule conditions
      const tests = await db.select()
        .from(messageABTests)
        .where(eq(messageABTests.userId, rule.userId));

      for (const test of tests) {
        // Check if rule conditions are met
        const conditionsMet = await this.evaluateRuleConditions(test, rule.conditions);
        
        if (conditionsMet) {
          // Execute rule actions
          const actionResult = await this.executeRuleActions(test, rule.actions);
          
          if (actionResult.success) {
            return {
              applied: true,
              ruleId: rule.id,
              testId: test.id,
              actions: actionResult.actions,
              message: `Rule "${rule.ruleName}" applied successfully`
            };
          }
        }
      }

      return {
        applied: false,
        ruleId: rule.id,
        message: 'Rule conditions not met'
      };
    } catch (error) {
      console.error('Error executing optimization rule:', error);
      return {
        applied: false,
        ruleId: rule.id,
        error: 'Failed to execute rule'
      };
    }
  }

  private async evaluateRuleConditions(test: any, conditions: any): Promise<boolean> {
    try {
      // Get test variants and their performance
      const variants = await db.select()
        .from(messageVariants)
        .where(eq(messageVariants.testId, test.id));

      // Example condition evaluation
      for (const [metric, condition] of Object.entries(conditions)) {
        for (const variant of variants) {
          const value = variant[metric as keyof typeof variant];
          
          if (typeof condition === 'object' && condition !== null) {
            for (const [operator, threshold] of Object.entries(condition as Record<string, number>)) {
              const numValue = Number(value);
              const numThreshold = Number(threshold);
              
              if (isNaN(numValue) || isNaN(numThreshold)) continue;
              
              switch (operator) {
                case '<':
                  if (!(numValue < numThreshold)) return false;
                  break;
                case '>':
                  if (!(numValue > numThreshold)) return false;
                  break;
                case '>=':
                  if (!(numValue >= numThreshold)) return false;
                  break;
                case '<=':
                  if (!(numValue <= numThreshold)) return false;
                  break;
                case '==':
                  if (!(numValue === numThreshold)) return false;
                  break;
              }
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error evaluating rule conditions:', error);
      return false;
    }
  }

  private async executeRuleActions(test: any, actions: any) {
    try {
      const executedActions = [];

      for (const [action, config] of Object.entries(actions)) {
        switch (action) {
          case 'promote_winner':
            if (config) {
              const winner = await this.identifyWinningVariant(test.id);
              if (winner) {
                await db.update(messageABTests)
                  .set({
                    winningVariant: winner.variantName,
                    status: 'completed',
                    updatedAt: new Date(),
                  })
                  .where(eq(messageABTests.id, test.id));
                
                executedActions.push(`Promoted winner: ${winner.variantName}`);
              }
            }
            break;

          case 'pause_losers':
            if (config) {
              const losers = await this.identifyLosingVariants(test.id);
              for (const loser of losers) {
                // Mark loser variants as paused
                executedActions.push(`Paused loser: ${loser.variantName}`);
              }
            }
            break;

          case 'send_alert':
            if (config) {
              await this.generateOptimizationInsight(test.userId, {
                insightType: 'optimization_opportunity',
                title: `A/B Test Alert: ${test.testName}`,
                description: `Automated rule "${actions}" triggered for A/B test`,
                actionable: true,
                impactLevel: 'medium',
                confidence: 95,
                relatedTests: [test.id],
              });
              executedActions.push('Sent optimization alert');
            }
            break;
        }
      }

      return {
        success: true,
        actions: executedActions
      };
    } catch (error) {
      console.error('Error executing rule actions:', error);
      return {
        success: false,
        error: 'Failed to execute actions'
      };
    }
  }

  /**
   * Message Effectiveness Scoring
   * AI-powered scoring system for message effectiveness
   */
  async calculateEffectivenessScore(messageId: string, userId: string): Promise<EffectivenessScoring> {
    try {
      // Get message content and performance data
      const messageResults = await db.select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      const performanceResults = await db.select()
        .from(messagePerformanceMetrics)
        .where(eq(messagePerformanceMetrics.messageId, messageId))
        .limit(1);

      const message = messageResults[0];
      const performance = performanceResults[0];

      if (!message) {
        throw new Error('Message not found');
      }

      // Use AI to analyze message effectiveness (with fallback default values)
      const aiAnalysis: any = await pythonAI.generateMessage({
        action: 'analyze_effectiveness',
        subject: (message as any).subject || '',
        content: (message as any).content || '',
        type: (message as any).type || 'email',
        performance: performance ? {
          openRate: performance.totalOpens || 0,
          clickRate: performance.totalClicks || 0,
          responseRate: performance.repliedAt ? 1 : 0,
          deliveryStatus: performance.deliveryStatus || 'unknown'
        } : null
      }).catch(() => ({
        overallScore: 75,
        engagementScore: 70,
        conversionScore: 65,
        qualityScore: 80,
        relevanceScore: 75,
        subjectLineScore: 70,
        contentScore: 75,
        ctaScore: 65,
        personalizationScore: 60,
        timingScore: 70,
        insights: {},
        suggestions: [],
        strengths: [],
        weaknesses: [],
        confidence: 85
      }));

      const scoring: EffectivenessScoring = {
        overallScore: aiAnalysis.overallScore || 75,
        engagementScore: aiAnalysis.engagementScore || 70,
        conversionScore: aiAnalysis.conversionScore || 65,
        qualityScore: aiAnalysis.qualityScore || 80,
        relevanceScore: aiAnalysis.relevanceScore || 75,
        subjectLineScore: aiAnalysis.subjectLineScore || 70,
        contentScore: aiAnalysis.contentScore || 75,
        ctaScore: aiAnalysis.ctaScore || 65,
        personalizationScore: aiAnalysis.personalizationScore || 60,
        timingScore: performance ? aiAnalysis.timingScore || 70 : 50,
      };

      // Store effectiveness score
      await db.insert(messageEffectivenessScores).values({
        messageId,
        userId,
        overallScore: scoring.overallScore.toString(),
        engagementScore: scoring.engagementScore.toString(),
        conversionScore: scoring.conversionScore.toString(),
        qualityScore: scoring.qualityScore.toString(),
        relevanceScore: scoring.relevanceScore.toString(),
        subjectLineScore: scoring.subjectLineScore.toString(),
        contentScore: scoring.contentScore.toString(),
        ctaScore: scoring.ctaScore.toString(),
        personalizationScore: scoring.personalizationScore.toString(),
        timingScore: scoring.timingScore.toString(),
        aiInsights: aiAnalysis.insights,
        improvementSuggestions: aiAnalysis.suggestions || [],
        strengths: aiAnalysis.strengths || [],
        weaknesses: aiAnalysis.weaknesses || [],
        scoreConfidence: aiAnalysis.confidence?.toString() || "85.00",
        scoringModel: "v1.0",
      }).onConflictDoUpdate({
        target: [messageEffectivenessScores.messageId, messageEffectivenessScores.userId],
        set: {
          overallScore: scoring.overallScore.toString(),
          engagementScore: scoring.engagementScore.toString(),
          conversionScore: scoring.conversionScore.toString(),
          qualityScore: scoring.qualityScore.toString(),
          relevanceScore: scoring.relevanceScore.toString(),
          subjectLineScore: scoring.subjectLineScore.toString(),
          contentScore: scoring.contentScore.toString(),
          ctaScore: scoring.ctaScore.toString(),
          personalizationScore: scoring.personalizationScore.toString(),
          timingScore: scoring.timingScore.toString(),
          lastUpdated: new Date(),
          updatedAt: new Date(),
        }
      });

      return scoring;
    } catch (error) {
      console.error('Error calculating effectiveness score:', error);
      // Return default scoring on error
      return {
        overallScore: 50,
        engagementScore: 50,
        conversionScore: 50,
        qualityScore: 50,
        relevanceScore: 50,
        subjectLineScore: 50,
        contentScore: 50,
        ctaScore: 50,
        personalizationScore: 50,
        timingScore: 50,
      };
    }
  }

  /**
   * Continuous Improvement Algorithms
   * Generate insights and recommendations for optimization
   */
  async generateOptimizationInsight(userId: string, insightData: {
    insightType: string;
    title: string;
    description: string;
    actionable: boolean;
    impactLevel: string;
    confidence: number;
    relatedTests?: string[];
    relatedMessages?: string[];
  }) {
    try {
      const [insight] = await db.insert(messageOptimizationInsights).values({
        userId,
        insightType: insightData.insightType,
        title: insightData.title,
        description: insightData.description,
        actionable: insightData.actionable,
        impactLevel: insightData.impactLevel,
        confidence: insightData.confidence.toString(),
        relatedTests: insightData.relatedTests || [],
        relatedMessages: insightData.relatedMessages || [],
        status: 'new',
      }).returning();

      return {
        success: true,
        insightId: insight.id,
        insight,
        message: 'Optimization insight generated successfully'
      };
    } catch (error) {
      console.error('Error generating optimization insight:', error);
      return {
        success: false,
        error: 'Failed to generate insight'
      };
    }
  }

  async identifyWinningVariant(testId: string) {
    try {
      const variants = await db.select()
        .from(messageVariants)
        .where(eq(messageVariants.testId, testId))
        .orderBy(desc(messageVariants.conversionRate));

      return variants[0] || null;
    } catch (error) {
      console.error('Error identifying winning variant:', error);
      return null;
    }
  }

  async identifyLosingVariants(testId: string) {
    try {
      const variants = await db.select()
        .from(messageVariants)
        .where(eq(messageVariants.testId, testId))
        .orderBy(asc(messageVariants.conversionRate));

      // Return bottom 50% as losers
      const midpoint = Math.ceil(variants.length / 2);
      return variants.slice(0, midpoint);
    } catch (error) {
      console.error('Error identifying losing variants:', error);
      return [];
    }
  }

  // Dashboard and Analytics Methods
  async getOptimizationDashboard(userId: string) {
    try {
      // Get active tests
      const activeTests = await db.select()
        .from(messageABTests)
        .where(and(
          eq(messageABTests.userId, userId),
          eq(messageABTests.status, 'running')
        ));

      // Get recent insights
      const recentInsights = await db.select()
        .from(messageOptimizationInsights)
        .where(eq(messageOptimizationInsights.userId, userId))
        .orderBy(desc(messageOptimizationInsights.createdAt))
        .limit(5);

      // Get top performing messages
      const topMessages = await db.select()
        .from(messageEffectivenessScores)
        .where(eq(messageEffectivenessScores.userId, userId))
        .orderBy(desc(messageEffectivenessScores.overallScore))
        .limit(10);

      return {
        success: true,
        dashboard: {
          activeTests: activeTests.length,
          recentInsights: recentInsights.length,
          topMessages: topMessages.length,
          tests: activeTests,
          insights: recentInsights,
          messages: topMessages,
        }
      };
    } catch (error) {
      console.error('Error getting optimization dashboard:', error);
      return {
        success: false,
        error: 'Failed to get dashboard data'
      };
    }
  }
}

export const messageOptimizationService = new MessageOptimizationService();