import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { 
  prospects, 
  companyProfiles, 
  industryTrends, 
  contextAnalyses, 
  personalizationContexts, 
  messageOptimizations,
  type InsertCompanyProfile,
  type CompanyProfile,
  type InsertIndustryTrend,
  type IndustryTrend,
  type InsertContextAnalysis,
  type ContextAnalysis,
  type InsertPersonalizationContext,
  type PersonalizationContext,
  type InsertMessageOptimization,
  type MessageOptimization,
  type Prospect
} from "@shared/schema";

// Define interfaces for AI analysis
interface CompanyIntelligenceData {
  companyName: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  linkedinUrl?: string;
  description?: string;
}

interface IndustryAnalysisRequest {
  industry: string;
  region?: string;
  companySize?: string;
}

interface PersonalizationAnalysisData {
  prospect: Prospect;
  companyProfile?: CompanyProfile;
  industryTrend?: IndustryTrend;
  message?: string;
}

interface MessageOptimizationRequest {
  originalMessage: string;
  contextAnalysis: ContextAnalysis;
  optimizationType: 'tone' | 'length' | 'structure' | 'personalization';
}

class ContextAnalysisService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly AI_MODEL = "claude-sonnet-4-20250514";

  /**
   * CARD-028: Company Intelligence Analysis
   * AI-powered company profile analysis and intelligence gathering
   */
  async analyzeCompanyIntelligence(
    userId: string, 
    companyData: CompanyIntelligenceData
  ): Promise<CompanyProfile> {
    const startTime = Date.now();

    try {
      // Check if company profile already exists
      const existingProfile = await db
        .select()
        .from(companyProfiles)
        .where(
          and(
            eq(companyProfiles.userId, userId),
            companyData.domain ? 
              eq(companyProfiles.domain, companyData.domain) :
              eq(companyProfiles.companyName, companyData.companyName)
          )
        )
        .limit(1);

      if (existingProfile.length > 0 && 
          existingProfile[0].lastAnalyzed && 
          Date.now() - new Date(existingProfile[0].lastAnalyzed).getTime() < 24 * 60 * 60 * 1000) {
        return existingProfile[0];
      }

      // Generate AI-powered company intelligence
      const aiInsights = await this.generateCompanyIntelligence(companyData);
      
      const profileData: InsertCompanyProfile = {
        userId,
        companyName: companyData.companyName,
        domain: companyData.domain,
        industry: companyData.industry || aiInsights.industry,
        size: companyData.size || aiInsights.size,
        businessModel: aiInsights.businessModel,
        revenueRange: aiInsights.revenueRange,
        fundingStage: aiInsights.fundingStage,
        techStack: aiInsights.techStack,
        competitorAnalysis: aiInsights.competitorAnalysis,
        marketPosition: aiInsights.marketPosition,
        contextScore: aiInsights.contextScore,
        personalityProfile: aiInsights.personalityProfile,
        decisionMakingProcess: aiInsights.decisionMakingProcess,
        painPoints: aiInsights.painPoints,
        priorities: aiInsights.priorities,
        communicationStyle: aiInsights.communicationStyle,
        dataSource: 'ai_analysis',
        lastAnalyzed: new Date(),
        analysisVersion: '1.0',
        confidence: aiInsights.confidence
      };

      const [profile] = existingProfile.length > 0 ?
        await db.update(companyProfiles)
          .set({ ...profileData, updatedAt: new Date() })
          .where(eq(companyProfiles.id, existingProfile[0].id))
          .returning() :
        await db.insert(companyProfiles)
          .values(profileData)
          .returning();
      
      console.log(`Company intelligence analysis completed in ${Date.now() - startTime}ms`);
      return profile;

    } catch (error) {
      console.error('Company intelligence analysis failed:', error);
      throw new Error('Failed to analyze company intelligence');
    }
  }

  /**
   * Industry Trend Analysis
   * AI-powered industry trend analysis and market intelligence
   */
  async analyzeIndustryTrends(
    userId: string, 
    analysisRequest: IndustryAnalysisRequest
  ): Promise<IndustryTrend> {
    const startTime = Date.now();

    try {
      // Check for recent analysis
      const existingTrend = await db
        .select()
        .from(industryTrends)
        .where(
          and(
            eq(industryTrends.userId, userId),
            eq(industryTrends.industry, analysisRequest.industry),
            gte(industryTrends.analysisDate, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(industryTrends.analysisDate))
        .limit(1);

      if (existingTrend.length > 0) {
        return existingTrend[0];
      }

      // Generate AI-powered industry analysis
      const trendInsights = await this.generateIndustryAnalysis(analysisRequest);

      const trendData: InsertIndustryTrend = {
        userId,
        industry: analysisRequest.industry,
        marketSize: trendInsights.marketSize,
        growthRate: trendInsights.growthRate,
        maturityStage: trendInsights.maturityStage,
        keyDrivers: trendInsights.keyDrivers,
        challenges: trendInsights.challenges,
        opportunities: trendInsights.opportunities,
        emergingTechnologies: trendInsights.emergingTechnologies,
        disruptiveTrends: trendInsights.disruptiveTrends,
        adoptionPatterns: trendInsights.adoptionPatterns,
        trendScore: trendInsights.trendScore,
        predictiveInsights: trendInsights.predictiveInsights,
        recommendedActions: trendInsights.recommendedActions,
        analysisDate: new Date(),
        dataSource: 'ai_analysis',
        confidence: trendInsights.confidence
      };

      const [trend] = await db.insert(industryTrends)
        .values(trendData)
        .returning();
      
      console.log(`Industry trend analysis completed in ${Date.now() - startTime}ms`);
      return trend;

    } catch (error) {
      console.error('Industry trend analysis failed:', error);
      throw new Error('Failed to analyze industry trends');
    }
  }

  /**
   * Comprehensive Context Analysis
   * Combines company intelligence, industry trends, and prospect data for comprehensive analysis
   */
  async performContextAnalysis(
    userId: string,
    prospectId: string,
    analysisType: 'quick' | 'comprehensive' | 'deep' = 'comprehensive'
  ): Promise<ContextAnalysis> {
    const startTime = Date.now();

    try {
      // Get prospect data
      const prospectResults = await db
        .select()
        .from(prospects)
        .where(and(
          eq(prospects.id, prospectId),
          eq(prospects.userId, userId)
        ));

      if (prospectResults.length === 0) {
        throw new Error('Prospect not found');
      }
      
      const prospect = prospectResults[0];

      // Get or create company profile
      let companyProfile: CompanyProfile | undefined;
      if (prospect.company) {
        try {
          companyProfile = await this.analyzeCompanyIntelligence(userId, {
            companyName: prospect.company,
            domain: prospect.websiteUrl?.replace(/^https?:\/\//, ''),
            industry: prospect.industry || undefined,
          });
        } catch (error) {
          console.warn('Company intelligence analysis failed:', error);
        }
      }

      // Get industry trends
      let industryTrend: IndustryTrend | undefined;
      if (prospect.industry) {
        try {
          industryTrend = await this.analyzeIndustryTrends(userId, {
            industry: prospect.industry
          });
        } catch (error) {
          console.warn('Industry trend analysis failed:', error);
        }
      }

      // Generate comprehensive context analysis
      const contextInsights = await this.generateContextAnalysis({
        prospect,
        companyProfile,
        industryTrend
      }, analysisType);

      const analysisData: InsertContextAnalysis = {
        userId,
        prospectId,
        companyProfileId: companyProfile?.id,
        overallScore: contextInsights.overallScore,
        contextFactors: contextInsights.contextFactors,
        personalizationOpportunities: contextInsights.personalizationOpportunities,
        recommendedApproach: contextInsights.recommendedApproach,
        keyMessages: contextInsights.keyMessages,
        timingScore: contextInsights.timingScore,
        relevanceScore: contextInsights.relevanceScore,
        authorityScore: contextInsights.authorityScore,
        readinessScore: contextInsights.readinessScore,
        aiInsights: contextInsights.aiInsights,
        riskFactors: contextInsights.riskFactors,
        successFactors: contextInsights.successFactors,
        nextBestActions: contextInsights.nextBestActions,
        analysisType,
        modelVersion: '1.0',
        processingTime: Date.now() - startTime
      };

      const [analysis] = await db.insert(contextAnalyses)
        .values(analysisData)
        .returning();
      
      console.log(`Context analysis completed in ${Date.now() - startTime}ms`);
      return analysis;

    } catch (error) {
      console.error('Context analysis failed:', error);
      throw new Error('Failed to perform context analysis');
    }
  }

  /**
   * Personalization Context Scoring
   * Generates personalization scores and recommendations
   */
  async generatePersonalizationContext(
    userId: string,
    prospectId: string,
    contextAnalysisId?: number
  ): Promise<PersonalizationContext> {
    try {
      // Get prospect and context analysis
      const prospectResults = await db
        .select()
        .from(prospects)
        .where(and(
          eq(prospects.id, prospectId),
          eq(prospects.userId, userId)
        ));

      if (prospectResults.length === 0) {
        throw new Error('Prospect not found');
      }
      
      const prospect = prospectResults[0];

      let contextAnalysis: ContextAnalysis | undefined;
      if (contextAnalysisId) {
        const analysisResults = await db
          .select()
          .from(contextAnalyses)
          .where(eq(contextAnalyses.id, contextAnalysisId));
        contextAnalysis = analysisResults[0];
      }

      // Generate personalization insights
      const personalizationInsights = await this.generatePersonalizationInsights({
        prospect,
        contextAnalysis
      });

      const personalizationData: InsertPersonalizationContext = {
        userId,
        prospectId,
        contextAnalysisId,
        personalityFit: personalizationInsights.personalityFit,
        communicationStyle: personalizationInsights.communicationStyle,
        preferredTone: personalizationInsights.preferredTone,
        decisionMakingStyle: personalizationInsights.decisionMakingStyle,
        industryContext: personalizationInsights.industryContext,
        roleContext: personalizationInsights.roleContext,
        companyContext: personalizationInsights.companyContext,
        personalContext: personalizationInsights.personalContext,
        messageOptimization: personalizationInsights.messageOptimization,
        channelPreferences: personalizationInsights.channelPreferences,
        timingRecommendations: personalizationInsights.timingRecommendations,
        contentRecommendations: personalizationInsights.contentRecommendations,
        effectivenessScore: personalizationInsights.effectivenessScore,
        conversionProbability: personalizationInsights.conversionProbability,
        engagementPrediction: personalizationInsights.engagementPrediction
      };

      const [personalization] = await db.insert(personalizationContexts)
        .values(personalizationData)
        .returning();

      return personalization;

    } catch (error) {
      console.error('Personalization context generation failed:', error);
      throw new Error('Failed to generate personalization context');
    }
  }

  /**
   * Message Optimization
   * Context-based message optimization using AI
   */
  async optimizeMessage(
    userId: string,
    optimizationRequest: MessageOptimizationRequest
  ): Promise<MessageOptimization> {
    try {
      // Generate optimized message using AI
      const optimizationResult = await this.generateMessageOptimization(optimizationRequest);

      const optimizationData: InsertMessageOptimization = {
        userId,
        messageId: undefined, // Can be linked later
        contextAnalysisId: optimizationRequest.contextAnalysis.id,
        originalMessage: optimizationRequest.originalMessage,
        optimizedMessage: optimizationResult.optimizedMessage,
        optimizationType: optimizationRequest.optimizationType,
        improvementScore: optimizationResult.improvementScore,
        readabilityScore: optimizationResult.readabilityScore,
        personalizationScore: optimizationResult.personalizationScore,
        engagementScore: optimizationResult.engagementScore,
        optimizationRationale: optimizationResult.optimizationRationale,
        keyChanges: optimizationResult.keyChanges,
        expectedImpact: optimizationResult.expectedImpact,
        riskAssessment: optimizationResult.riskAssessment,
        testVariant: 'A',
        performanceMetrics: {},
        isWinner: false
      };

      const [optimization] = await db.insert(messageOptimizations)
        .values(optimizationData)
        .returning();

      return optimization;

    } catch (error) {
      console.error('Message optimization failed:', error);
      throw new Error('Failed to optimize message');
    }
  }

  /**
   * Get Context Analysis Dashboard Data
   */
  async getContextAnalyticsDashboard(userId: string, timeRange = '7d') {
    try {
      const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get analysis metrics
      const analyses = await db
        .select()
        .from(contextAnalyses)
        .where(and(
          eq(contextAnalyses.userId, userId),
          gte(contextAnalyses.createdAt, startDate)
        ));

      const personalizations = await db
        .select()
        .from(personalizationContexts)
        .where(and(
          eq(personalizationContexts.userId, userId),
          gte(personalizationContexts.createdAt, startDate)
        ));

      const optimizations = await db
        .select()
        .from(messageOptimizations)
        .where(and(
          eq(messageOptimizations.userId, userId),
          gte(messageOptimizations.createdAt, startDate)
        ));

      const profileResults = await db
        .select()
        .from(companyProfiles)
        .where(and(
          eq(companyProfiles.userId, userId),
          gte(companyProfiles.createdAt, startDate)
        ));

      const dashboard = {
        summary: {
          totalAnalyses: analyses.length,
          averageContextScore: analyses.length > 0 ? 
            analyses.reduce((sum, a) => sum + Number(a.overallScore || 0), 0) / analyses.length : 0,
          totalPersonalizations: personalizations.length,
          averagePersonalizationFit: personalizations.length > 0 ?
            personalizations.reduce((sum, p) => sum + Number(p.personalityFit || 0), 0) / personalizations.length : 0,
          totalOptimizations: optimizations.length,
          averageImprovementScore: optimizations.length > 0 ?
            optimizations.reduce((sum, o) => sum + Number(o.improvementScore || 0), 0) / optimizations.length : 0,
          companyProfilesCreated: profileResults.length
        },
        trends: {
          analysisVolume: this.groupByDate(analyses, 'createdAt'),
          scoreDistribution: this.getScoreDistribution(analyses.map(a => Number(a.overallScore || 0))),
          personalizationTrends: this.groupByDate(personalizations, 'createdAt'),
          optimizationTrends: this.groupByDate(optimizations, 'createdAt')
        },
        insights: {
          topIndustries: this.getTopIndustries(profileResults),
          commonPainPoints: this.extractPainPoints(profileResults),
          effectiveStrategies: this.getEffectiveStrategies(analyses),
          improvementOpportunities: this.getImprovementOpportunities(analyses)
        }
      };

      return dashboard;

    } catch (error) {
      console.error('Context analytics dashboard failed:', error);
      throw new Error('Failed to generate context analytics dashboard');
    }
  }

  // Private helper methods for AI integration
  private async generateCompanyIntelligence(companyData: CompanyIntelligenceData) {
    // Mock AI response for now - replace with actual OpenRouter/Claude integration
    return {
      industry: companyData.industry || 'Technology',
      size: companyData.size || 'Medium',
      businessModel: 'B2B SaaS',
      revenueRange: '$10M-$50M',
      fundingStage: 'Series B',
      techStack: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
      competitorAnalysis: {
        directCompetitors: [],
        competitiveAdvantages: [],
        marketPosition: 'challenger'
      },
      marketPosition: 'challenger',
      contextScore: '78.5',
      personalityProfile: {
        culture: 'innovative',
        values: ['customer-focused', 'data-driven'],
        communicationStyle: 'professional'
      },
      decisionMakingProcess: {
        style: 'consensus',
        timeframe: '2-3 months',
        keyStakeholders: ['CTO', 'VP Engineering']
      },
      painPoints: ['scalability', 'integration challenges', 'team productivity'],
      priorities: ['digital transformation', 'cost optimization', 'team scaling'],
      communicationStyle: 'professional',
      confidence: '82.3'
    };
  }

  private async generateIndustryAnalysis(request: IndustryAnalysisRequest) {
    // Mock AI response for now - replace with actual OpenRouter/Claude integration
    return {
      marketSize: '125000000000',
      growthRate: '12.5',
      maturityStage: 'growth',
      keyDrivers: ['digital transformation', 'remote work', 'AI adoption'],
      challenges: ['talent shortage', 'security concerns', 'regulatory compliance'],
      opportunities: ['automation', 'personalization', 'data analytics'],
      emergingTechnologies: ['AI/ML', 'blockchain', 'IoT'],
      disruptiveTrends: ['no-code platforms', 'edge computing', 'quantum computing'],
      adoptionPatterns: {
        earlyAdopters: '15%',
        mainstream: '60%',
        laggards: '25%'
      },
      trendScore: '85.2',
      predictiveInsights: {
        nextQuarter: 'continued growth in AI adoption',
        nextYear: 'consolidation of no-code platforms'
      },
      recommendedActions: ['invest in AI capabilities', 'focus on security', 'develop partnerships'],
      confidence: '87.4'
    };
  }

  private async generateContextAnalysis(data: PersonalizationAnalysisData, analysisType: string) {
    // Mock AI response for now - replace with actual OpenRouter/Claude integration
    return {
      overallScore: '76.8',
      contextFactors: {
        timing: 'good',
        relevance: 'high',
        readiness: 'medium',
        authority: 'high'
      },
      personalizationOpportunities: {
        industrySpecific: ['mention recent industry trends', 'address common pain points'],
        roleSpecific: ['focus on technical challenges', 'highlight efficiency gains'],
        companySpecific: ['reference their tech stack', 'mention growth stage challenges']
      },
      recommendedApproach: 'consultative sales approach with technical focus',
      keyMessages: ['proven ROI in similar companies', 'easy integration', 'scalable solution'],
      timingScore: '72.3',
      relevanceScore: '84.1',
      authorityScore: '79.6',
      readinessScore: '71.2',
      aiInsights: {
        buyingSignals: ['recent funding', 'hiring spree', 'technology expansion'],
        concerns: ['budget constraints', 'implementation timeline'],
        decisionFactors: ['ROI', 'ease of use', 'vendor support']
      },
      riskFactors: ['competitive evaluation', 'budget approval process'],
      successFactors: ['technical proof of concept', 'strong references', 'flexible pricing'],
      nextBestActions: ['send technical overview', 'schedule demo', 'provide case studies']
    };
  }

  private async generatePersonalizationInsights(data: { prospect: Prospect; contextAnalysis?: ContextAnalysis }) {
    // Mock AI response for now - replace with actual OpenRouter/Claude integration
    return {
      personalityFit: '78.5',
      communicationStyle: 'professional',
      preferredTone: 'technical',
      decisionMakingStyle: 'analytical',
      industryContext: {
        trends: ['digital transformation', 'AI adoption'],
        challenges: ['talent shortage', 'security']
      },
      roleContext: {
        responsibilities: ['technical decisions', 'team management'],
        painPoints: ['scalability', 'integration']
      },
      companyContext: {
        stage: 'growth',
        priorities: ['efficiency', 'scalability']
      },
      personalContext: {
        experience: 'senior',
        expertise: ['software development', 'system architecture']
      },
      messageOptimization: {
        length: 'medium',
        structure: 'problem-solution-benefit',
        callToAction: 'schedule demo'
      },
      channelPreferences: ['email', 'linkedin'],
      timingRecommendations: {
        bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
        bestTimes: ['10:00', '14:00']
      },
      contentRecommendations: {
        topics: ['technical benefits', 'ROI case studies'],
        formats: ['demo', 'whitepaper', 'case study']
      },
      effectivenessScore: '82.1',
      conversionProbability: '34.7',
      engagementPrediction: {
        openRate: '78%',
        responseRate: '23%',
        meetingAcceptance: '45%'
      }
    };
  }

  private async generateMessageOptimization(request: MessageOptimizationRequest) {
    // Mock AI response for now - replace with actual OpenRouter/Claude integration
    return {
      optimizedMessage: `Hi ${request.contextAnalysis.prospectId},

I noticed your company is in a growth phase and likely facing scalability challenges. Our platform has helped similar ${request.contextAnalysis.prospectId} companies improve efficiency by 40%.

Would you be interested in a 15-minute technical overview?

Best regards,`,
      improvementScore: '23.4',
      readabilityScore: '87.2',
      personalizationScore: '91.5',
      engagementScore: '78.9',
      optimizationRationale: 'Improved personalization and clear value proposition',
      keyChanges: ['added industry context', 'included specific metrics', 'shortened call-to-action'],
      expectedImpact: {
        responseRate: '+35%',
        engagementScore: '+23%',
        meetingAcceptance: '+18%'
      },
      riskAssessment: {
        level: 'low',
        factors: ['maintain professional tone', 'verify company stage']
      }
    };
  }

  // Helper methods for analytics
  private groupByDate(items: any[], dateField: string) {
    // Implementation for grouping data by date
    return [];
  }

  private getScoreDistribution(scores: number[]) {
    // Implementation for score distribution analysis
    return [];
  }

  private getTopIndustries(profiles: CompanyProfile[]) {
    // Implementation for top industries analysis
    return [];
  }

  private extractPainPoints(profiles: CompanyProfile[]) {
    // Implementation for pain points extraction
    return [];
  }

  private getEffectiveStrategies(analyses: ContextAnalysis[]) {
    // Implementation for effective strategies analysis
    return [];
  }

  private getImprovementOpportunities(analyses: ContextAnalysis[]) {
    // Implementation for improvement opportunities analysis
    return [];
  }
}

export const contextAnalysisService = new ContextAnalysisService();