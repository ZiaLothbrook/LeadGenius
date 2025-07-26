import { aiService } from "./aiService";
import type { Prospect } from "@shared/schema";

export interface MessageGenerationRequest {
  prospectId?: string;
  prospect: {
    name: string;
    title: string;
    company: string;
    industry: string;
    email?: string;
    context?: any;
  };
  campaignContext: {
    productName: string;
    productDescription: string;
    valueProposition: string;
    callToAction: string;
  };
  messageOptions: {
    tone: "professional" | "casual" | "friendly" | "executive";
    length: "short" | "medium" | "long";
    personalizationLevel: "basic" | "advanced" | "hyper-personalized";
    includeDataPoints: string[];
    avoidTopics?: string[];
  };
  templateType: "cold-email" | "follow-up" | "linkedin" | "demo-request" | "value-prop";
}

export interface GeneratedMessage {
  id: string;
  subject: string;
  body: string;
  personalizationScore: number;
  variants: MessageVariant[];
  metadata: {
    tone: string;
    readingTime: string;
    personalizationPoints: string[];
    callToActionStrength: number;
    complianceCheck: ComplianceResult;
  };
  previewText: string;
  aiConfidence: number;
}

export interface MessageVariant {
  id: string;
  type: "a/b-test" | "alternative" | "shorter" | "longer";
  subject: string;
  body: string;
  description: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  issues: string[];
  suggestions: string[];
}

export interface BulkGenerationRequest {
  prospects: MessageGenerationRequest["prospect"][];
  campaignContext: MessageGenerationRequest["campaignContext"];
  messageOptions: MessageGenerationRequest["messageOptions"];
  templateType: MessageGenerationRequest["templateType"];
}

export interface BulkGenerationResponse {
  success: boolean;
  totalGenerated: number;
  messages: GeneratedMessage[];
  processingTime: number;
  aiInsights: {
    averagePersonalizationScore: number;
    topPerformingVariations: string[];
    recommendedSendTimes: string[];
    industrySpecificInsights: Record<string, string>;
  };
}

/**
 * AI-Powered Message Generation Service
 * Creates hyper-personalized messages at scale using advanced AI models
 */
export class MessageGenerationService {
  private aiService = aiService;
  
  constructor() {
    console.log("🚀 AI Message Generation Service initialized");
  }

  /**
   * Generate a single personalized message
   */
  async generateMessage(request: MessageGenerationRequest): Promise<GeneratedMessage> {
    try {
      console.log("✉️ Generating personalized message for:", request.prospect.name);

      // Generate main message
      const mainMessage = await this.createPersonalizedMessage(request);
      
      // Generate variants for A/B testing
      const variants = await this.generateVariants(request, mainMessage);
      
      // Analyze personalization and compliance
      const metadata = await this.analyzeMessage(mainMessage, request);
      
      return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...mainMessage,
        personalizationScore: metadata.personalizationPoints.length * 25, // Calculate score based on personalization points
        variants,
        metadata,
        previewText: this.generatePreviewText(mainMessage.body),
        aiConfidence: this.calculateConfidence(metadata),
      };
      
    } catch (error) {
      console.error("❌ Error generating message:", error);
      throw new Error("Failed to generate personalized message");
    }
  }

  /**
   * Generate messages for multiple prospects in bulk
   */
  async generateBulkMessages(request: BulkGenerationRequest): Promise<BulkGenerationResponse> {
    try {
      console.log("📧 Starting bulk message generation for", request.prospects.length, "prospects");
      const startTime = Date.now();
      
      // Process in batches for efficiency
      const batchSize = 5;
      const messages: GeneratedMessage[] = [];
      
      for (let i = 0; i < request.prospects.length; i += batchSize) {
        const batch = request.prospects.slice(i, i + batchSize);
        const batchPromises = batch.map(prospect => 
          this.generateMessage({
            prospect,
            campaignContext: request.campaignContext,
            messageOptions: request.messageOptions,
            templateType: request.templateType,
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        messages.push(...batchResults);
        
        // Progress update
        console.log(`✅ Processed ${messages.length}/${request.prospects.length} messages`);
      }
      
      const processingTime = Date.now() - startTime;
      const aiInsights = this.generateBulkInsights(messages, request);
      
      return {
        success: true,
        totalGenerated: messages.length,
        messages,
        processingTime,
        aiInsights,
      };
      
    } catch (error) {
      console.error("❌ Error in bulk generation:", error);
      throw new Error("Failed to generate bulk messages");
    }
  }

  /**
   * Create the main personalized message using AI
   */
  private async createPersonalizedMessage(request: MessageGenerationRequest): Promise<{ subject: string; body: string }> {
    const prompt = `Generate a ${request.templateType} message for the following prospect:

Prospect Details:
- Name: ${request.prospect.name}
- Title: ${request.prospect.title}
- Company: ${request.prospect.company}
- Industry: ${request.prospect.industry}

Campaign Context:
- Product: ${request.campaignContext.productName}
- Description: ${request.campaignContext.productDescription}
- Value Proposition: ${request.campaignContext.valueProposition}
- Call to Action: ${request.campaignContext.callToAction}

Message Requirements:
- Tone: ${request.messageOptions.tone}
- Length: ${request.messageOptions.length}
- Personalization Level: ${request.messageOptions.personalizationLevel}
- Include: ${request.messageOptions.includeDataPoints.join(", ")}
${request.messageOptions.avoidTopics ? `- Avoid: ${request.messageOptions.avoidTopics.join(", ")}` : ""}

Create a compelling, personalized message that:
1. Addresses the prospect's specific role and industry challenges
2. Clearly communicates the value proposition
3. Includes a strong, clear call to action
4. Feels genuine and non-generic
5. Uses the appropriate tone and length

Return the response in JSON format:
{
  "subject": "email subject line",
  "body": "email body with proper formatting and paragraphs"
}`;

    try {
      const response = await this.aiService.generatePersonalizedMessage(prompt, {
        tone: request.messageOptions.tone,
        model: "anthropic/claude-3.5-sonnet-20241022",
      });
      
      const parsed = this.parseJSONResponse(response);
      return {
        subject: parsed.subject || "Personalized Message for You",
        body: parsed.body || "Generated message content",
      };
    } catch (error) {
      console.error("Error creating personalized message:", error);
      // Fallback message
      return this.createFallbackMessage(request);
    }
  }

  /**
   * Generate message variants for A/B testing
   */
  private async generateVariants(request: MessageGenerationRequest, mainMessage: { subject: string; body: string }): Promise<MessageVariant[]> {
    const variants: MessageVariant[] = [];
    
    // Generate a shorter variant
    const shorterPrompt = `Make this message 30% shorter while keeping the key points:
Subject: ${mainMessage.subject}
Body: ${mainMessage.body}

Return as JSON: { "subject": "...", "body": "..." }`;
    
    try {
      const shorterResponse = await this.aiService.generatePersonalizedMessage(shorterPrompt, {
        tone: request.messageOptions.tone,
        model: "anthropic/claude-3.5-sonnet-20241022",
      });
      
      const parsed = this.parseJSONResponse(shorterResponse);
      variants.push({
        id: `variant-shorter-${Date.now()}`,
        type: "shorter",
        subject: parsed.subject || mainMessage.subject,
        body: parsed.body || mainMessage.body,
        description: "Concise version - 30% shorter",
      });
    } catch (error) {
      console.error("Error generating shorter variant:", error);
    }
    
    // Generate an alternative approach
    const alternativePrompt = `Create an alternative approach to this message with a different angle:
Original Subject: ${mainMessage.subject}
Keep the same goal but try a different opening and value proposition approach.

Return as JSON: { "subject": "...", "body": "..." }`;
    
    try {
      const altResponse = await this.aiService.generatePersonalizedMessage(alternativePrompt, {
        tone: request.messageOptions.tone,
        model: "anthropic/claude-3.5-sonnet-20241022",
      });
      
      const parsed = this.parseJSONResponse(altResponse);
      variants.push({
        id: `variant-alt-${Date.now()}`,
        type: "alternative",
        subject: parsed.subject || mainMessage.subject,
        body: parsed.body || mainMessage.body,
        description: "Alternative approach - Different angle",
      });
    } catch (error) {
      console.error("Error generating alternative variant:", error);
    }
    
    return variants;
  }

  /**
   * Analyze message for metadata and compliance
   */
  private async analyzeMessage(message: { subject: string; body: string }, request: MessageGenerationRequest) {
    const wordCount = message.body.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200) + " min";
    
    // Extract personalization points
    const personalizationPoints: string[] = [];
    if (message.body.includes(request.prospect.name)) {
      personalizationPoints.push("Name personalization");
    }
    if (message.body.includes(request.prospect.company)) {
      personalizationPoints.push("Company mention");
    }
    if (message.body.toLowerCase().includes(request.prospect.industry.toLowerCase())) {
      personalizationPoints.push("Industry-specific content");
    }
    if (message.body.includes(request.prospect.title)) {
      personalizationPoints.push("Role-specific messaging");
    }
    
    // Compliance check
    const complianceCheck = this.checkCompliance(message);
    
    // CTA strength (1-10)
    const callToActionStrength = this.assessCTAStrength(message.body);
    
    return {
      tone: request.messageOptions.tone,
      readingTime,
      personalizationPoints,
      callToActionStrength,
      complianceCheck,
    };
  }

  /**
   * Check message compliance
   */
  private checkCompliance(message: { subject: string; body: string }): ComplianceResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check for spam triggers
    const spamTriggers = ["FREE", "GUARANTEED", "CLICK HERE", "LIMITED TIME", "ACT NOW"];
    const upperBody = message.body.toUpperCase();
    const upperSubject = message.subject.toUpperCase();
    
    spamTriggers.forEach(trigger => {
      if (upperBody.includes(trigger) || upperSubject.includes(trigger)) {
        issues.push(`Contains spam trigger: ${trigger}`);
        suggestions.push(`Consider rephrasing to avoid "${trigger}"`);
      }
    });
    
    // Check for unsubscribe
    if (!message.body.toLowerCase().includes("unsubscribe")) {
      suggestions.push("Consider adding an unsubscribe option for email compliance");
    }
    
    return {
      isCompliant: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Assess the strength of the call to action
   */
  private assessCTAStrength(body: string): number {
    let strength = 5; // Base score
    
    const strongCTAs = ["schedule", "book", "let's talk", "reply", "click", "start", "get"];
    const weakCTAs = ["learn more", "see more", "find out", "discover"];
    
    const lowerBody = body.toLowerCase();
    
    strongCTAs.forEach(cta => {
      if (lowerBody.includes(cta)) strength += 1;
    });
    
    weakCTAs.forEach(cta => {
      if (lowerBody.includes(cta)) strength -= 0.5;
    });
    
    // Cap between 1 and 10
    return Math.max(1, Math.min(10, Math.round(strength)));
  }

  /**
   * Generate preview text from body
   */
  private generatePreviewText(body: string): string {
    // Remove line breaks and extra spaces
    const cleanBody = body.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    // Return first 150 characters
    return cleanBody.length > 150 ? cleanBody.substring(0, 147) + "..." : cleanBody;
  }

  /**
   * Calculate AI confidence score
   */
  private calculateConfidence(metadata: any): number {
    let confidence = 70; // Base confidence
    
    // Boost for personalization
    confidence += metadata.personalizationPoints.length * 5;
    
    // Boost for strong CTA
    confidence += metadata.callToActionStrength * 2;
    
    // Reduce for compliance issues
    confidence -= metadata.complianceCheck.issues.length * 10;
    
    // Cap between 0 and 100
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Generate insights for bulk generation
   */
  private generateBulkInsights(messages: GeneratedMessage[], request: BulkGenerationRequest) {
    const avgPersonalization = messages.reduce((sum, msg) => sum + msg.personalizationScore, 0) / messages.length;
    
    // Find top performing variations
    const variantCounts: Record<string, number> = {};
    messages.forEach(msg => {
      msg.variants.forEach(variant => {
        variantCounts[variant.type] = (variantCounts[variant.type] || 0) + 1;
      });
    });
    
    const topVariations = Object.entries(variantCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
    
    // Industry-specific insights
    const industryInsights: Record<string, string> = {};
    const industries = Array.from(new Set(request.prospects.map(p => p.industry)));
    
    industries.forEach(industry => {
      industryInsights[industry] = `Personalized messaging for ${industry} professionals`;
    });
    
    return {
      averagePersonalizationScore: Math.round(avgPersonalization),
      topPerformingVariations: topVariations,
      recommendedSendTimes: ["Tuesday 10am", "Wednesday 2pm", "Thursday 11am"],
      industrySpecificInsights: industryInsights,
    };
  }

  /**
   * Parse JSON response with fallback
   */
  private parseJSONResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse JSON from response");
          return {};
        }
      }
      return {};
    }
  }

  /**
   * Create fallback message when AI fails
   */
  private createFallbackMessage(request: MessageGenerationRequest): { subject: string; body: string } {
    return {
      subject: `${request.campaignContext.productName} - Transforming ${request.prospect.industry}`,
      body: `Hi ${request.prospect.name},

I noticed you're leading ${request.prospect.title} initiatives at ${request.prospect.company}, and I wanted to reach out about ${request.campaignContext.productName}.

${request.campaignContext.valueProposition}

Companies in ${request.prospect.industry} are seeing significant results with our solution, and I believe ${request.prospect.company} could benefit similarly.

${request.campaignContext.callToAction}

Best regards,
[Your Name]`,
    };
  }
}

export const messageGenerationService = new MessageGenerationService();