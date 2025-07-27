import { z } from "zod";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Available models with their capabilities
const MODELS = {
  // Anthropic models - best for reasoning and analysis
  // The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-5-sonnet-20241022" 
  CLAUDE_SONNET_4: "anthropic/claude-sonnet-4-20250514",
  CLAUDE_SONNET: "anthropic/claude-3-5-sonnet-20241022",
  CLAUDE_HAIKU: "anthropic/claude-3-haiku",
  
  // Google models - good for structured output
  GEMINI_PRO: "google/gemini-pro-1.5",
  GEMINI_FLASH: "google/gemini-flash-1.5",
} as const;

class OpenRouterService {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }
  }

  private async makeRequest(
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const requestMessages = systemPrompt 
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://leadgen-ai.replit.app",
        "X-Title": "AI Lead Generation Platform",
      },
      body: JSON.stringify({
        model,
        messages: requestMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  // Generate personalized messages using Claude for better reasoning
  async generatePersonalizedMessage(
    prospect: {
      name: string;
      company: string;
      title: string;
      industry: string;
      location?: string;
    },
    messageType: "cold_email" | "linkedin_message" | "follow_up",
    tone: "professional" | "casual" | "friendly",
    context?: string
  ): Promise<string> {
    const systemPrompt = `You are an expert sales copywriter specializing in B2B lead generation. 
    Generate highly personalized, compelling ${messageType.replace("_", " ")} messages that:
    - Are ${tone} in tone
    - Reference specific details about the prospect's role and company
    - Include a clear value proposition
    - Have a specific call-to-action
    - Are concise (under 150 words for emails, under 300 characters for LinkedIn)
    - Avoid generic sales language and spam triggers`;

    const prospectInfo = `
    Prospect: ${prospect.name}
    Title: ${prospect.title}
    Company: ${prospect.company}
    Industry: ${prospect.industry}
    ${prospect.location ? `Location: ${prospect.location}` : ""}
    ${context ? `Additional context: ${context}` : ""}
    `;

    const messages = [
      {
        role: "user",
        content: `Generate a ${messageType.replace("_", " ")} for this prospect:\n${prospectInfo}`
      }
    ];

    return this.makeRequest(MODELS.CLAUDE_SONNET_4, messages, systemPrompt);
  }

  // Enhanced message generation with structured output
  async generateStructuredMessage(
    prompt: string,
    options: {
      tone: "professional" | "casual" | "friendly" | "executive";
      model?: string;
      maxTokens?: number;
    }
  ): Promise<string> {
    const model = options.model || MODELS.CLAUDE_SONNET_4;
    const systemPrompt = `You are an expert sales copywriter. Generate responses in valid JSON format.
    Use a ${options.tone} tone and ensure all content is professional and compelling.`;

    return this.makeRequest(model, [
      { role: "user", content: prompt }
    ], systemPrompt);
  }

  // Enrich prospect data using Gemini for structured output
  async enrichProspectData(prospect: {
    name?: string;
    company?: string;
    email?: string;
    title?: string;
  }): Promise<{
    enrichedData: {
      industry?: string;
      companySize?: string;
      location?: string;
      phone?: string;
      linkedinUrl?: string;
      technologies?: string[];
      recentNews?: string;
    };
    confidence: number;
  }> {
    const systemPrompt = `You are a data enrichment specialist. Based on the provided prospect information, 
    generate likely enriched data points. Return only realistic, plausible information that could be found 
    through research. If you're not confident about specific details, omit them.
    
    Respond with valid JSON in this exact format:
    {
      "enrichedData": {
        "industry": "string or null",
        "companySize": "1-10|11-50|51-200|200+" or null,
        "location": "City, State/Country" or null,
        "phone": "+1 (555) 123-4567 format" or null,
        "linkedinUrl": "https://linkedin.com/in/..." or null,
        "technologies": ["tech1", "tech2"] or [],
        "recentNews": "brief relevant news" or null
      },
      "confidence": 0.1-1.0
    }`;

    const prospectInfo = `
    Name: ${prospect.name || "Not provided"}
    Company: ${prospect.company || "Not provided"}
    Email: ${prospect.email || "Not provided"}
    Title: ${prospect.title || "Not provided"}
    `;

    const messages = [
      {
        role: "user",
        content: `Enrich this prospect data:\n${prospectInfo}`
      }
    ];

    try {
      const response = await this.makeRequest(MODELS.GEMINI_PRO, messages, systemPrompt);
      const parsed = JSON.parse(response);
      
      // Validate response structure
      const enrichmentSchema = z.object({
        enrichedData: z.object({
          industry: z.string().optional(),
          companySize: z.enum(["1-10", "11-50", "51-200", "200+"]).optional(),
          location: z.string().optional(),
          phone: z.string().optional(),
          linkedinUrl: z.string().url().optional(),
          technologies: z.array(z.string()).optional(),
          recentNews: z.string().optional(),
        }),
        confidence: z.number().min(0).max(1),
      });

      return enrichmentSchema.parse(parsed);
    } catch (error) {
      console.error("Error parsing enrichment response:", error);
      return {
        enrichedData: {},
        confidence: 0.1
      };
    }
  }

  // Generate email subject lines using Claude
  async generateEmailSubjects(
    prospect: { name: string; company: string; title: string },
    count: number = 3
  ): Promise<string[]> {
    const systemPrompt = `Generate compelling email subject lines for B2B outreach. 
    Create ${count} different subject lines that are:
    - Personalized to the prospect
    - Intriguing but not clickbait
    - Professional and relevant
    - Under 50 characters
    - Avoid spam trigger words
    
    Return as a JSON array of strings.`;

    const messages = [
      {
        role: "user",
        content: `Generate subject lines for: ${prospect.name}, ${prospect.title} at ${prospect.company}`
      }
    ];

    try {
      const response = await this.makeRequest(MODELS.CLAUDE_HAIKU, messages, systemPrompt);
      return JSON.parse(response);
    } catch (error) {
      console.error("Error generating subject lines:", error);
      return [
        `Quick question about ${prospect.company}`,
        `${prospect.name}, thoughts on this?`,
        `Helping ${prospect.company} with [specific area]`
      ];
    }
  }

  // Analyze prospect sentiment and priority using Anthropic
  async analyzeProspectPriority(prospect: {
    name: string;
    company: string;
    title: string;
    industry: string;
    recentNews?: string;
  }): Promise<{
    priority: "high" | "medium" | "low";
    reasoning: string;
    score: number;
  }> {
    const systemPrompt = `You are a sales intelligence analyst. Analyze this prospect and determine their priority level for outreach.
    
    Consider:
    - Job title seniority and decision-making power
    - Company size and growth potential
    - Industry trends and opportunities
    - Recent news or events
    
    Respond with JSON:
    {
      "priority": "high|medium|low",
      "reasoning": "brief explanation",
      "score": 1-100
    }`;

    const prospectInfo = `
    Name: ${prospect.name}
    Title: ${prospect.title}
    Company: ${prospect.company}
    Industry: ${prospect.industry}
    ${prospect.recentNews ? `Recent News: ${prospect.recentNews}` : ""}
    `;

    try {
      const response = await this.makeRequest(MODELS.CLAUDE_SONNET, [
        { role: "user", content: `Analyze this prospect:\n${prospectInfo}` }
      ], systemPrompt);
      
      return JSON.parse(response);
    } catch (error) {
      console.error("Error analyzing prospect priority:", error);
      return {
        priority: "medium",
        reasoning: "Unable to analyze - requires manual review",
        score: 50
      };
    }
  }

  // Analyze prospect fit for scoring
  async analyzeProspectFit(params: {
    prospect: any;
    searchCriteria: any;
    dataPoints: {
      hasEmail: boolean;
      hasPhone: boolean;
      hasLinkedIn: boolean;
      dataSourceCount: number;
      hasTechnologies: boolean;
    };
  }): Promise<{ fitScore: number; intentSignals: string[] }> {
    const { prospect, searchCriteria, dataPoints } = params;
    
    try {
      const prompt = `Analyze this prospect for fit and intent signals:
      
Prospect: ${prospect.name} - ${prospect.title} at ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.location}
Search Criteria: ${JSON.stringify(searchCriteria, null, 2)}
Data Quality: ${JSON.stringify(dataPoints, null, 2)}

Provide a fit score (0-100) and list any buying intent signals you detect.
Return as JSON: { "fitScore": number, "intentSignals": ["signal1", "signal2"] }`;

      const response = await this.makeRequest(
        MODELS.CLAUDE_SONNET,
        [{ role: "user", content: prompt }],
        "You are an expert sales analyst who identifies high-quality prospects and buying signals."
      );

      try {
        const result = JSON.parse(response);
        return {
          fitScore: Math.min(100, Math.max(0, result.fitScore)),
          intentSignals: result.intentSignals || []
        };
      } catch {
        // Fallback scoring based on data quality
        const baseScore = 50;
        const emailBonus = dataPoints.hasEmail ? 15 : 0;
        const phoneBonus = dataPoints.hasPhone ? 10 : 0;
        const linkedInBonus = dataPoints.hasLinkedIn ? 10 : 0;
        const sourceBonus = dataPoints.dataSourceCount > 1 ? 15 : 0;
        
        return {
          fitScore: baseScore + emailBonus + phoneBonus + linkedInBonus + sourceBonus,
          intentSignals: []
        };
      }
    } catch (error) {
      console.error("Error analyzing prospect fit:", error);
      return { fitScore: 50, intentSignals: [] };
    }
  }
}

export const aiService = new OpenRouterService();