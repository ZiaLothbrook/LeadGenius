import { storage } from "../storage";
import { campaignOrchestrationEngine, type CampaignSequenceStep, type CampaignOrchestrationConfig } from "./campaignOrchestrationEngine";
import type { Campaign, Prospect } from "@shared/schema";

export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  industry?: string;
  useCase: 'lead_generation' | 'follow_up' | 'nurture' | 'reactivation';
  steps: CampaignSequenceStep[];
  estimatedDuration: number; // days
  expectedResponseRate: number; // percentage
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: {
    event: 'email_opened' | 'email_clicked' | 'email_replied' | 'no_response' | 'form_filled';
    conditions?: {
      timeFrame?: number; // hours
      minInteractions?: number;
    };
  };
  action: {
    type: 'advance_sequence' | 'pause_sequence' | 'change_sequence' | 'assign_tag' | 'notify_user';
    parameters: any;
  };
  isActive: boolean;
}

class CampaignSequenceManager {
  private sequenceTemplates: SequenceTemplate[] = [
    {
      id: 'cold_outreach_saas',
      name: 'SaaS Cold Outreach Sequence',
      description: 'Proven 7-step sequence for SaaS lead generation',
      industry: 'technology',
      useCase: 'lead_generation',
      estimatedDuration: 21,
      expectedResponseRate: 12.5,
      steps: [
        {
          id: 'step_1',
          stepNumber: 1,
          channel: 'email',
          delayDays: 0,
          messageTemplate: 'initial_value_prop',
          subject: 'Quick question about {{company}}',
          isActive: true
        },
        {
          id: 'step_2',
          stepNumber: 2,
          channel: 'linkedin',
          delayDays: 3,
          messageTemplate: 'linkedin_connection',
          conditions: { noReplyFor: 3 },
          isActive: true
        },
        {
          id: 'step_3',
          stepNumber: 3,
          channel: 'email',
          delayDays: 7,
          messageTemplate: 'social_proof_case_study',
          subject: 'How {{similar_company}} increased revenue by 40%',
          conditions: { noReplyFor: 7 },
          isActive: true
        },
        {
          id: 'step_4',
          stepNumber: 4,
          channel: 'email',
          delayDays: 14,
          messageTemplate: 'resource_sharing',
          subject: 'Free resource for {{company}}',
          conditions: { noReplyFor: 7 },
          isActive: true
        },
        {
          id: 'step_5',
          stepNumber: 5,
          channel: 'phone',
          delayDays: 18,
          messageTemplate: 'phone_script_brief',
          conditions: { noReplyFor: 4 },
          isActive: true
        },
        {
          id: 'step_6',
          stepNumber: 6,
          channel: 'email',
          delayDays: 21,
          messageTemplate: 'final_attempt',
          subject: 'Final follow-up - {{company}}',
          conditions: { noReplyFor: 3 },
          isActive: true
        }
      ]
    },
    {
      id: 'warm_followup',
      name: 'Warm Lead Follow-up',
      description: 'Nurture sequence for engaged prospects',
      useCase: 'follow_up',
      estimatedDuration: 14,
      expectedResponseRate: 25.0,
      steps: [
        {
          id: 'warm_1',
          stepNumber: 1,
          channel: 'email',
          delayDays: 1,
          messageTemplate: 'thank_you_engagement',
          subject: 'Thanks for your interest in {{product}}',
          isActive: true
        },
        {
          id: 'warm_2',
          stepNumber: 2,
          channel: 'email',
          delayDays: 4,
          messageTemplate: 'detailed_demo_offer',
          subject: 'Ready for a personalized demo?',
          isActive: true
        },
        {
          id: 'warm_3',
          stepNumber: 3,
          channel: 'phone',
          delayDays: 7,
          messageTemplate: 'phone_script_demo',
          conditions: { openRequired: true },
          isActive: true
        }
      ]
    }
  ];

  /**
   * Get all available sequence templates
   */
  getSequenceTemplates(filters?: { industry?: string; useCase?: string }): SequenceTemplate[] {
    let templates = this.sequenceTemplates;
    
    if (filters?.industry) {
      templates = templates.filter(t => !t.industry || t.industry === filters.industry);
    }
    
    if (filters?.useCase) {
      templates = templates.filter(t => t.useCase === filters.useCase);
    }
    
    return templates;
  }

  /**
   * Create a custom sequence for a campaign
   */
  async createCustomSequence(campaignId: string, steps: Omit<CampaignSequenceStep, 'id'>[]): Promise<CampaignSequenceStep[]> {
    try {
      console.log(`📝 Creating custom sequence for campaign ${campaignId}`);
      
      const sequenceSteps: CampaignSequenceStep[] = steps.map((step, index) => ({
        ...step,
        id: `custom_${campaignId}_${index + 1}`,
        stepNumber: index + 1
      }));

      // Validate sequence logic
      this.validateSequence(sequenceSteps);
      
      console.log(`✅ Created ${sequenceSteps.length}-step custom sequence`);
      return sequenceSteps;
      
    } catch (error) {
      console.error("❌ Error creating custom sequence:", error);
      throw error;
    }
  }

  /**
   * Apply a template sequence to a campaign
   */
  async applySequenceTemplate(campaignId: string, templateId: string): Promise<CampaignOrchestrationConfig> {
    try {
      const template = this.sequenceTemplates.find(t => t.id === templateId);
      if (!template) {
        throw new Error(`Sequence template ${templateId} not found`);
      }

      console.log(`🎯 Applying sequence template ${template.name} to campaign ${campaignId}`);

      const config: CampaignOrchestrationConfig = {
        campaignId,
        sequences: template.steps,
        timing: {
          workingHours: {
            start: "09:00",
            end: "17:00",
            timezone: "America/New_York"
          },
          workingDays: [1, 2, 3, 4, 5], // Mon-Fri
          respectTimeZones: true
        },
        optimization: {
          abTestEnabled: true,
          personalizedTiming: true,
          engagementThreshold: 0.1,
          autoOptimize: true
        },
        tracking: {
          trackOpens: true,
          trackClicks: true,
          trackReplies: true,
          utmParameters: true
        }
      };

      // Initialize the campaign orchestration
      await campaignOrchestrationEngine.initializeCampaign(config);
      
      console.log(`✅ Sequence template applied successfully`);
      return config;
      
    } catch (error) {
      console.error("❌ Error applying sequence template:", error);
      throw error;
    }
  }

  /**
   * Validate sequence logic and timing
   */
  private validateSequence(steps: CampaignSequenceStep[]): void {
    if (steps.length === 0) {
      throw new Error("Sequence must have at least one step");
    }

    // Check for sequential step numbers
    const sortedSteps = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].stepNumber !== i + 1) {
        throw new Error(`Invalid step numbering: expected ${i + 1}, got ${sortedSteps[i].stepNumber}`);
      }
    }

    // Validate delay progression
    for (let i = 1; i < sortedSteps.length; i++) {
      const currentDelay = sortedSteps[i].delayDays;
      const previousDelay = sortedSteps[i - 1].delayDays;
      
      if (currentDelay <= previousDelay) {
        throw new Error(`Step ${i + 1} delay (${currentDelay}) must be greater than step ${i} delay (${previousDelay})`);
      }
    }

    // Validate message templates exist
    for (const step of steps) {
      if (!step.messageTemplate) {
        throw new Error(`Step ${step.stepNumber} is missing message template`);
      }
    }

    console.log(`✅ Sequence validation passed for ${steps.length} steps`);
  }

  /**
   * Get sequence performance analytics
   */
  async getSequenceAnalytics(campaignId: string): Promise<{
    stepPerformance: Array<{
      stepId: string;
      stepNumber: number;
      channel: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      replied: number;
      conversionRate: number;
      avgResponseTime: number; // hours
      dropOffRate: number;
    }>;
    overallMetrics: {
      totalProspects: number;
      activeInSequence: number;
      completedSequence: number;
      avgStepsCompleted: number;
      sequenceConversionRate: number;
    };
    recommendations: string[];
  }> {
    try {
      console.log(`📊 Analyzing sequence performance for campaign ${campaignId}`);
      
      const campaignProspects = await storage.getCampaignProspects(campaignId);
      const analytics = await storage.getAnalytics('', { campaignId }); // Would get userId from campaign
      
      // Calculate step performance
      const stepPerformance = []; // Would calculate from actual data
      
      // Calculate overall metrics
      const overallMetrics = {
        totalProspects: campaignProspects.length,
        activeInSequence: campaignProspects.filter(cp => cp.status === 'sent' || cp.status === 'pending').length,
        completedSequence: campaignProspects.filter(cp => cp.status === 'converted').length,
        avgStepsCompleted: 0, // Would calculate from engagement data
        sequenceConversionRate: 0 // Would calculate conversion rate
      };

      // Generate recommendations
      const recommendations = this.generateSequenceRecommendations(stepPerformance, overallMetrics);
      
      return {
        stepPerformance,
        overallMetrics,
        recommendations
      };
      
    } catch (error) {
      console.error("❌ Error getting sequence analytics:", error);
      throw error;
    }
  }

  /**
   * Generate recommendations for sequence optimization
   */
  private generateSequenceRecommendations(stepPerformance: any[], overallMetrics: any): string[] {
    const recommendations: string[] = [];
    
    if (overallMetrics.sequenceConversionRate < 0.05) {
      recommendations.push("Consider A/B testing different subject lines in early steps");
      recommendations.push("Review message personalization - low conversion suggests messaging isn't resonating");
    }
    
    if (overallMetrics.avgStepsCompleted < 2) {
      recommendations.push("First step may be too aggressive - consider softer opening approach");
      recommendations.push("Add value-driven content in step 2 to maintain engagement");
    }
    
    if (stepPerformance.length > 0) {
      const emailSteps = stepPerformance.filter(s => s.channel === 'email');
      const avgEmailOpen = emailSteps.reduce((sum, s) => sum + s.opened, 0) / emailSteps.length;
      
      if (avgEmailOpen < 0.2) {
        recommendations.push("Email open rates are low - test different send times and subject line formats");
      }
    }
    
    return recommendations;
  }

  /**
   * Create automation rules for sequence management
   */
  async createAutomationRule(campaignId: string, rule: Omit<AutomationRule, 'id'>): Promise<AutomationRule> {
    try {
      const automationRule: AutomationRule = {
        ...rule,
        id: `rule_${campaignId}_${Date.now()}`
      };

      console.log(`🤖 Creating automation rule: ${automationRule.name}`);
      
      // Validate rule logic
      this.validateAutomationRule(automationRule);
      
      // Store rule in database (implementation would go here)
      
      console.log(`✅ Automation rule created: ${automationRule.id}`);
      return automationRule;
      
    } catch (error) {
      console.error("❌ Error creating automation rule:", error);
      throw error;
    }
  }

  /**
   * Validate automation rule logic
   */
  private validateAutomationRule(rule: AutomationRule): void {
    if (!rule.name || rule.name.trim() === '') {
      throw new Error("Automation rule must have a name");
    }

    const validEvents = ['email_opened', 'email_clicked', 'email_replied', 'no_response', 'form_filled'];
    if (!validEvents.includes(rule.trigger.event)) {
      throw new Error(`Invalid trigger event: ${rule.trigger.event}`);
    }

    const validActions = ['advance_sequence', 'pause_sequence', 'change_sequence', 'assign_tag', 'notify_user'];
    if (!validActions.includes(rule.action.type)) {
      throw new Error(`Invalid action type: ${rule.action.type}`);
    }

    console.log(`✅ Automation rule validation passed`);
  }

  /**
   * Process automation rules for a prospect interaction
   */
  async processAutomationRules(campaignId: string, prospectId: string, event: string, metadata?: any): Promise<void> {
    try {
      console.log(`🤖 Processing automation rules for ${event} event`);
      
      // Get active automation rules for campaign
      const rules = await this.getActiveAutomationRules(campaignId);
      
      for (const rule of rules) {
        if (rule.trigger.event === event) {
          await this.executeAutomationAction(rule, prospectId, metadata);
        }
      }
      
    } catch (error) {
      console.error("❌ Error processing automation rules:", error);
    }
  }

  /**
   * Get active automation rules for a campaign
   */
  private async getActiveAutomationRules(campaignId: string): Promise<AutomationRule[]> {
    // Implementation would query database for active rules
    return [];
  }

  /**
   * Execute an automation action
   */
  private async executeAutomationAction(rule: AutomationRule, prospectId: string, metadata?: any): Promise<void> {
    console.log(`⚡ Executing automation action: ${rule.action.type}`);
    
    switch (rule.action.type) {
      case 'advance_sequence':
        // Move prospect to next step
        break;
      case 'pause_sequence':
        // Pause sequence for prospect
        break;
      case 'change_sequence':
        // Switch to different sequence
        break;
      case 'assign_tag':
        // Add tag to prospect
        break;
      case 'notify_user':
        // Send notification to user
        break;
    }
  }

  /**
   * Clone a sequence from another campaign
   */
  async cloneSequence(sourceCampaignId: string, targetCampaignId: string): Promise<CampaignSequenceStep[]> {
    try {
      console.log(`📋 Cloning sequence from ${sourceCampaignId} to ${targetCampaignId}`);
      
      // Get source sequence (implementation would query database)
      const sourceSteps: CampaignSequenceStep[] = []; // Would get from database
      
      // Create new steps with updated IDs
      const clonedSteps = sourceSteps.map(step => ({
        ...step,
        id: `cloned_${targetCampaignId}_${step.stepNumber}`
      }));
      
      console.log(`✅ Cloned ${clonedSteps.length} sequence steps`);
      return clonedSteps;
      
    } catch (error) {
      console.error("❌ Error cloning sequence:", error);
      throw error;
    }
  }
}

export const campaignSequenceManager = new CampaignSequenceManager();