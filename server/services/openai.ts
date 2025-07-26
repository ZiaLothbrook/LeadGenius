import OpenAI from "openai";
import type { Prospect } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface GenerateMessageParams {
  prospect: Prospect;
  campaignGoal: string;
  tone: string;
  messageType: string;
  additionalContext?: string;
}

interface MessageVariant {
  subject: string;
  content: string;
  confidenceScore: number;
  variant: string;
}

export async function generatePersonalizedMessage(params: GenerateMessageParams): Promise<MessageVariant[]> {
  const { prospect, campaignGoal, tone, messageType, additionalContext } = params;

  const prompt = `Generate 2 personalized ${messageType} message variants for this prospect:

Prospect Information:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Title: ${prospect.title}
- Industry: ${prospect.industry}
- Location: ${prospect.location}

Campaign Goal: ${campaignGoal}
Tone: ${tone}
Additional Context: ${additionalContext || 'None provided'}

Requirements:
1. Create 2 different message variants (A and B)
2. Each variant should have a subject line and message content
3. Personalize based on the prospect's role, company, and industry
4. Keep messages concise and action-oriented
5. Include a clear call-to-action
6. Provide a confidence score (1-100) for each variant

Respond in JSON format with this structure:
{
  "variants": [
    {
      "variant": "A",
      "subject": "Subject line for variant A",
      "content": "Message content for variant A",
      "confidenceScore": 85,
      "reasoning": "Brief explanation of approach"
    },
    {
      "variant": "B", 
      "subject": "Subject line for variant B",
      "content": "Message content for variant B",
      "confidenceScore": 92,
      "reasoning": "Brief explanation of approach"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert sales copywriter specializing in personalized outreach messages. Generate highly effective, personalized messages that drive responses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return result.variants.map((variant: any) => ({
      subject: variant.subject,
      content: variant.content,
      confidenceScore: variant.confidenceScore,
      variant: variant.variant,
    }));
  } catch (error) {
    console.error("Error generating personalized message:", error);
    throw new Error("Failed to generate personalized message");
  }
}

export async function enrichProspectData(prospect: Prospect): Promise<Partial<Prospect>> {
  const prompt = `Based on the provided prospect information, enhance and enrich the data with realistic professional details:

Current Prospect Data:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Title: ${prospect.title}
- Industry: ${prospect.industry}
- Location: ${prospect.location}
- Email: ${prospect.email || 'Not provided'}
- Phone: ${prospect.phone || 'Not provided'}

Please provide enriched data including:
1. Professional email address (if missing)
2. Phone number (if missing)
3. LinkedIn URL
4. Company website URL
5. Enhanced industry classification
6. More specific job title if needed

Respond in JSON format:
{
  "email": "enhanced.email@company.com",
  "phone": "+1 (555) 123-4567",
  "linkedinUrl": "https://linkedin.com/in/prospect-name",
  "websiteUrl": "https://company-website.com",
  "industry": "Enhanced industry classification",
  "title": "Enhanced job title if needed"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data enrichment specialist. Provide realistic, professional contact information and enhance prospect data based on industry standards."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const enrichedData = JSON.parse(response.choices[0].message.content || '{}');
    
    // Only include fields that were actually enhanced (not empty)
    const result: Partial<Prospect> = {};
    
    if (enrichedData.email && (!prospect.email || prospect.email.length === 0)) {
      result.email = enrichedData.email;
    }
    
    if (enrichedData.phone && (!prospect.phone || prospect.phone.length === 0)) {
      result.phone = enrichedData.phone;
    }
    
    if (enrichedData.linkedinUrl) {
      result.linkedinUrl = enrichedData.linkedinUrl;
    }
    
    if (enrichedData.websiteUrl) {
      result.websiteUrl = enrichedData.websiteUrl;
    }
    
    if (enrichedData.industry && enrichedData.industry !== prospect.industry) {
      result.industry = enrichedData.industry;
    }
    
    if (enrichedData.title && enrichedData.title !== prospect.title) {
      result.title = enrichedData.title;
    }

    return result;
  } catch (error) {
    console.error("Error enriching prospect data:", error);
    throw new Error("Failed to enrich prospect data");
  }
}
