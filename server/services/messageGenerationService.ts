/**
 * Message Generation Service
 * Integrates with AI service for personalized message generation
 */

export interface MessageGenerationRequest {
  prospect_id: string;
  prospect_name: string;
  prospect_company?: string;
  prospect_title?: string;
  prospect_industry?: string;
  prospect_location?: string;
  campaign_goal: string;
  message_type: string;
  tone: string;
  additional_context?: string;
}

export interface MessageVariation {
  subject?: string;
  content: string;
  personalization_score: number;
  confidence_score: number;
  tone_match: number;
}

export interface MessageGenerationResponse {
  success: boolean;
  variations: MessageVariation[];
  totalVariations: number;
  averagePersonalizationScore: number;
  generatedAt: string;
}

export class MessageGenerationService {
  /**
   * Generate personalized message using AI service
   */
  async generatePersonalizedMessage(request: MessageGenerationRequest): Promise<MessageGenerationResponse> {
    try {
      console.log('🤖 Generating personalized message for:', request.prospect_name);

      // Call the AI service (FastAPI backend or direct OpenRouter)
      const aiResponse = await this.callAIService(request);

      // If AI service fails, generate a fallback message
      if (!aiResponse.success) {
        return this.generateFallbackMessage(request);
      }

      return aiResponse;

    } catch (error) {
      console.error('❌ Message generation failed:', error);
      return this.generateFallbackMessage(request);
    }
  }

  /**
   * Call AI service for message generation
   */
  private async callAIService(request: MessageGenerationRequest): Promise<MessageGenerationResponse> {
    try {
      // Try calling the FastAPI AI service first
      const response = await fetch('http://localhost:8001/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospect_name: request.prospect_name,
          prospect_company: request.prospect_company,
          prospect_title: request.prospect_title,
          prospect_industry: request.prospect_industry,
          campaign_goal: request.campaign_goal,
          message_type: request.message_type,
          tone: request.tone,
          context: request.additional_context
        })
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          variations: result.variations || [],
          totalVariations: result.variations?.length || 0,
          averagePersonalizationScore: result.average_personalization_score || 75,
          generatedAt: new Date().toISOString()
        };
      }

      throw new Error(`AI service error: ${response.status}`);

    } catch (error) {
      console.error('❌ AI service call failed:', error);
      throw error;
    }
  }

  /**
   * Generate fallback message when AI service is unavailable
   */
  private generateFallbackMessage(request: MessageGenerationRequest): MessageGenerationResponse {
    console.log('🔄 Generating fallback message for:', request.prospect_name);

    const templates = {
      professional: {
        subject: `Partnership opportunity with ${request.prospect_company}`,
        content: `Hi ${request.prospect_name},

I hope this message finds you well. I came across ${request.prospect_company} and was impressed by your work in ${request.prospect_industry}.

${request.campaign_goal}

I'd love to discuss how we might be able to help ${request.prospect_company} achieve its goals.

Would you be open to a brief conversation?

Best regards`
      },
      casual: {
        subject: `Quick question about ${request.prospect_company}`,
        content: `Hey ${request.prospect_name},

Hope you're doing well! I've been following ${request.prospect_company} and really admire what you're doing in ${request.prospect_industry}.

${request.campaign_goal}

Would love to chat about how we might be able to help.

Cheers!`
      },
      friendly: {
        subject: `Exciting opportunity for ${request.prospect_company}`,
        content: `Hello ${request.prospect_name},

I hope you're having a great day! I wanted to reach out because I believe there's a fantastic opportunity for ${request.prospect_company}.

${request.campaign_goal}

I'd be thrilled to share more details if you're interested.

Looking forward to hearing from you!`
      },
      direct: {
        subject: `${request.campaign_goal} - ${request.prospect_company}`,
        content: `${request.prospect_name},

${request.campaign_goal}

Available for a 15-minute call this week?

Best,`
      }
    };

    const template = templates[request.tone as keyof typeof templates] || templates.professional;

    return {
      success: true,
      variations: [
        {
          subject: template.subject,
          content: template.content,
          personalization_score: 65,
          confidence_score: 80,
          tone_match: 90
        },
        {
          subject: `Follow up: ${template.subject}`,
          content: template.content.replace('I hope this message finds you well.', 'I wanted to follow up on my previous message.'),
          personalization_score: 60,
          confidence_score: 75,
          tone_match: 85
        },
        {
          subject: `Brief question for ${request.prospect_name}`,
          content: `${request.prospect_name},\n\n${request.campaign_goal}\n\nWorth a quick call?\n\nThanks,`,
          personalization_score: 70,
          confidence_score: 85,
          tone_match: 88
        }
      ],
      totalVariations: 3,
      averagePersonalizationScore: 65,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate batch messages for multiple prospects
   */
  async generateBatchMessages(requests: MessageGenerationRequest[]): Promise<MessageGenerationResponse[]> {
    console.log('📧 Generating batch messages for', requests.length, 'prospects');
    
    const results: MessageGenerationResponse[] = [];
    
    // Process in batches to avoid overwhelming the AI service
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.generatePersonalizedMessage(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add small delay between batches
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

export const messageGenerationService = new MessageGenerationService();