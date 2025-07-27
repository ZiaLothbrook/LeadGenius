"""
AI Client for handling OpenRouter API calls with Pydantic validation
"""

import os
import json
import uuid
import httpx
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from ..models import (
    MessageGenerationRequest,
    MessageGenerationResponse,
    MessageVariant,
    MessageMetadata,
    PersonalizationPoint,
    ProspectEnrichmentRequest,
    ProspectEnrichmentResponse,
    EnrichedData
)

logger = logging.getLogger(__name__)

class AIClient:
    """Client for OpenRouter AI API with Pydantic validation"""
    
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        
        self.base_url = "https://openrouter.ai/api/v1"
        self.default_model = "anthropic/claude-sonnet-4"  # Latest Claude model
        self.enrichment_model = "google/gemini-pro-1.5"  # Good for structured data
        
        # HTTP client with timeout and retry configuration
        self.client = httpx.AsyncClient(
            timeout=120.0,  # 2 minutes for AI processing
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
        
        logger.info(f"🤖 AI Client initialized with model: {self.default_model}")

    async def _make_request(
        self,
        messages: List[Dict[str, str]],
        model: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """Make request to OpenRouter API"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-leadgen-platform.replit.dev",
            "X-Title": "AI Lead Generation Platform"
        }
        
        # Prepare messages with system prompt
        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.extend(messages)
        
        payload = {
            "model": model,
            "messages": formatted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False
        }
        
        try:
            logger.info(f"🚀 Making AI request to model: {model}")
            start_time = datetime.utcnow()
            
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds() * 1000
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"✅ AI request completed in {execution_time:.0f}ms")
            
            # Add execution time to result
            result["execution_time_ms"] = int(execution_time)
            return result
            
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ AI API error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"AI API error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"❌ AI request failed: {str(e)}")
            raise Exception(f"AI request failed: {str(e)}")

    async def generate_personalized_message(
        self,
        request: MessageGenerationRequest
    ) -> MessageGenerationResponse:
        """Generate personalized messages with multiple variants"""
        
        # Build comprehensive prospect context
        prospect_info = self._build_prospect_context(request.prospect)
        campaign_context = self._build_campaign_context(request.campaign_context)
        
        # Create system prompt for message generation
        system_prompt = f"""You are an expert sales copywriter specializing in {request.message_options.personalization_level.value} personalized outreach.

Generate {request.message_options.max_variants} distinct message variants with these requirements:
- Tone: {request.message_options.tone.value}
- Length: {request.message_options.length.value}
- Template: {request.message_options.template_type.value}
- Include social proof: {request.message_options.include_social_proof}

For each variant, provide:
1. Subject line (for emails)
2. Message content
3. Personalization score (0-1)
4. Confidence score (0-1)
5. CTA strength (0-1)
6. Estimated response rate (0-1)
7. Variant type (original/shorter/alternative)

Return ONLY valid JSON in this exact format:
{{
  "variants": [
    {{
      "id": "unique_id",
      "subject": "subject_line",
      "content": "message_content",
      "personalization_score": 0.95,
      "confidence": 0.92,
      "cta_strength": 0.88,
      "estimated_response_rate": 0.15,
      "variant_type": "original"
    }}
  ],
  "personalization_points": [
    {{
      "type": "company_specific",
      "value": "specific_detail",
      "confidence": 0.9,
      "source": "prospect_data"
    }}
  ]
}}"""

        user_message = f"""Generate personalized messages for:

PROSPECT:
{prospect_info}

CAMPAIGN:
{campaign_context}

Focus on creating genuine value and connection. Use specific details about the prospect and their company."""

        messages = [{"role": "user", "content": user_message}]
        
        # Make AI request
        result = await self._make_request(
            messages=messages,
            model=self.default_model,
            system_prompt=system_prompt,
            max_tokens=3000,
            temperature=0.8  # Higher creativity for marketing copy
        )
        
        # Parse and validate response
        try:
            ai_response = json.loads(result["choices"][0]["message"]["content"])
            
            # Create response with Pydantic validation
            variants = []
            for variant_data in ai_response.get("variants", []):
                variant = MessageVariant(
                    id=variant_data.get("id", str(uuid.uuid4())),
                    subject=variant_data["subject"],
                    content=variant_data["content"],
                    personalization_score=variant_data["personalization_score"],
                    confidence=variant_data["confidence"],
                    cta_strength=variant_data["cta_strength"],
                    estimated_response_rate=variant_data["estimated_response_rate"],
                    variant_type=variant_data["variant_type"]
                )
                variants.append(variant)
            
            # Create personalization points
            personalization_points = []
            for point_data in ai_response.get("personalization_points", []):
                point = PersonalizationPoint(
                    type=point_data["type"],
                    value=point_data["value"],
                    confidence=point_data["confidence"],
                    source=point_data["source"]
                )
                personalization_points.append(point)
            
            # Create metadata
            metadata = MessageMetadata(
                personalization_points=personalization_points,
                data_sources_used=["prospect_data", "campaign_context"],
                generation_time_ms=result.get("execution_time_ms", 0),
                model_used=self.default_model,
                prompt_tokens=result.get("usage", {}).get("prompt_tokens"),
                completion_tokens=result.get("usage", {}).get("completion_tokens")
            )
            
            return MessageGenerationResponse(
                id=str(uuid.uuid4()),
                variants=variants,
                metadata=metadata
            )
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"❌ Failed to parse AI response: {str(e)}")
            raise Exception(f"Failed to parse AI response: {str(e)}")

    async def enrich_prospect_data(
        self,
        request: ProspectEnrichmentRequest
    ) -> ProspectEnrichmentResponse:
        """Enrich prospect data using AI analysis"""
        
        prospect_info = self._build_prospect_context(request.prospect)
        
        system_prompt = """You are a data enrichment specialist. Analyze the provided prospect information and generate realistic enrichment data.

Return ONLY valid JSON in this exact format:
{
  "enriched_data": {
    "company_description": "description",
    "recent_funding": {"round": "Series A", "amount": "$5M", "date": "2024"},
    "key_executives": [{"name": "John Doe", "title": "CEO"}],
    "technologies_used": ["React", "AWS", "Stripe"],
    "company_news": ["Recent product launch", "New partnership"],
    "social_media_activity": {"linkedin_posts": 15, "engagement_rate": 0.08},
    "intent_signals": {"hiring": true, "funding": false, "expansion": true}
  },
  "confidence": 0.85,
  "data_quality_score": 0.92
}"""

        user_message = f"""Enrich this prospect data:

{prospect_info}

Provide comprehensive enrichment focusing on business intelligence, technology stack, recent activities, and buying signals."""

        messages = [{"role": "user", "content": user_message}]
        
        # Make AI request
        result = await self._make_request(
            messages=messages,
            model=self.enrichment_model,
            system_prompt=system_prompt,
            max_tokens=2000,
            temperature=0.5  # Lower temperature for factual data
        )
        
        # Parse and validate response
        try:
            ai_response = json.loads(result["choices"][0]["message"]["content"])
            
            enriched_data = EnrichedData(**ai_response["enriched_data"])
            
            return ProspectEnrichmentResponse(
                id=str(uuid.uuid4()),
                enriched_data=enriched_data,
                confidence=ai_response["confidence"],
                data_quality_score=ai_response["data_quality_score"],
                enrichment_sources=["ai_analysis", "public_data"]
            )
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"❌ Failed to parse enrichment response: {str(e)}")
            raise Exception(f"Failed to parse enrichment response: {str(e)}")

    async def analyze_intent_signals(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze buying intent signals from prospect data"""
        
        system_prompt = """Analyze the provided data for buying intent signals. Return JSON with intent scores and recommendations."""
        
        messages = [{"role": "user", "content": f"Analyze intent signals: {json.dumps(data)}"}]
        
        result = await self._make_request(
            messages=messages,
            model=self.default_model,
            system_prompt=system_prompt
        )
        
        try:
            return json.loads(result["choices"][0]["message"]["content"])
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"❌ Failed to parse intent analysis: {str(e)}")
            return {"error": "Failed to analyze intent signals"}

    def _build_prospect_context(self, prospect) -> str:
        """Build comprehensive prospect context string"""
        context_parts = [f"Name: {prospect.name}"]
        
        if prospect.title:
            context_parts.append(f"Title: {prospect.title}")
        if prospect.company:
            context_parts.append(f"Company: {prospect.company}")
        if prospect.industry:
            context_parts.append(f"Industry: {prospect.industry}")
        if prospect.location:
            context_parts.append(f"Location: {prospect.location}")
        if prospect.company_size:
            context_parts.append(f"Company Size: {prospect.company_size}")
        if prospect.technologies:
            context_parts.append(f"Technologies: {', '.join(prospect.technologies)}")
        if prospect.recent_news:
            context_parts.append(f"Recent News: {'; '.join(prospect.recent_news)}")
            
        return "\n".join(context_parts)

    def _build_campaign_context(self, campaign) -> str:
        """Build campaign context string"""
        return f"""Product: {campaign.product_name}
Description: {campaign.product_description}
Value Proposition: {campaign.value_proposition}
Call to Action: {campaign.call_to_action}
{f"Company Info: {campaign.company_info}" if campaign.company_info else ""}"""

    def get_default_model(self) -> str:
        """Get the default model name"""
        return self.default_model

    def get_enrichment_model(self) -> str:
        """Get the enrichment model name"""
        return self.enrichment_model

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()