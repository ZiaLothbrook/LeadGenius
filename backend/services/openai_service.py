"""
OpenAI GPT-4 API service for AI-powered lead generation
"""
import os
import openai
from typing import Dict, List, Optional, Any
import logging
import time
from pydantic import BaseModel
import json

logger = logging.getLogger(__name__)

# OpenAI API configuration
openai.api_key = os.getenv("OPENAI_API_KEY")

class MessageGenerationRequest(BaseModel):
    prospect_name: str
    prospect_company: str
    prospect_title: str
    prospect_industry: str
    campaign_goal: str
    message_type: str  # email, linkedin, sms
    tone: str  # professional, casual, friendly, direct
    additional_context: Optional[str] = None

class MessageGenerationResponse(BaseModel):
    message: str
    subject: Optional[str] = None
    confidence_score: float
    personalization_elements: List[str]
    cta_strength: str
    tone_match: str

class ProspectEnrichmentRequest(BaseModel):
    name: str
    company: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None

class ProspectEnrichmentResponse(BaseModel):
    enriched_data: Dict[str, Any]
    confidence_score: float
    data_sources: List[str]
    verification_status: str

class OpenAIService:
    def __init__(self):
        if not openai.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        self.model = "gpt-4"  # Use GPT-4 as specified
        
    async def generate_personalized_message(self, request: MessageGenerationRequest) -> MessageGenerationResponse:
        """Generate personalized message using GPT-4"""
        start_time = time.time()
        
        try:
            # Construct prompt for message generation
            system_prompt = f"""
You are an expert sales copywriter specializing in personalized outreach messages.
Generate a highly personalized {request.message_type} message with the following specifications:

Target Details:
- Name: {request.prospect_name}
- Company: {request.prospect_company}
- Title: {request.prospect_title}
- Industry: {request.prospect_industry}

Campaign Goal: {request.campaign_goal}
Tone: {request.tone}
Additional Context: {request.additional_context or 'None'}

Requirements:
1. Keep the message under 150 words for email, 100 words for LinkedIn
2. Include specific personalization elements related to their company/role
3. Create a compelling subject line (for email)
4. Include a clear call-to-action
5. Maintain the specified tone throughout

Respond in JSON format with:
- message: the personalized message content
- subject: subject line (for email) or null
- confidence_score: 0.0-1.0 based on personalization quality
- personalization_elements: list of specific elements used
- cta_strength: "weak", "moderate", or "strong"
- tone_match: how well the tone matches the request
"""

            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate a personalized {request.message_type} message for this prospect."}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            execution_time = time.time() - start_time
            
            # Parse response
            content = response.choices[0].message.content
            try:
                result_data = json.loads(content)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                result_data = {
                    "message": content,
                    "subject": f"Quick question about {request.prospect_company}" if request.message_type == "email" else None,
                    "confidence_score": 0.7,
                    "personalization_elements": ["company_name", "industry"],
                    "cta_strength": "moderate",
                    "tone_match": "good"
                }
            
            # Log the interaction
            await self._log_prompt_interaction(
                prompt_type="message_generation",
                input_data=request.dict(),
                output_data=result_data,
                execution_time=execution_time,
                token_usage=response.usage.dict() if hasattr(response, 'usage') else {}
            )
            
            return MessageGenerationResponse(**result_data)
            
        except Exception as e:
            logger.error(f"Error generating personalized message: {e}")
            execution_time = time.time() - start_time
            
            # Log the error
            await self._log_prompt_interaction(
                prompt_type="message_generation",
                input_data=request.dict(),
                output_data={"error": str(e)},
                execution_time=execution_time,
                success=False,
                error_message=str(e)
            )
            
            # Return fallback response
            return MessageGenerationResponse(
                message=f"Hi {request.prospect_name}, I noticed {request.prospect_company} is doing great work in {request.prospect_industry}. I'd love to discuss how we can help you achieve {request.campaign_goal}. Would you be open to a brief conversation?",
                subject=f"Quick question about {request.prospect_company}" if request.message_type == "email" else None,
                confidence_score=0.5,
                personalization_elements=["name", "company", "industry"],
                cta_strength="moderate",
                tone_match="professional"
            )
    
    async def enrich_prospect_data(self, request: ProspectEnrichmentRequest) -> ProspectEnrichmentResponse:
        """Enrich prospect data using GPT-4 analysis"""
        start_time = time.time()
        
        try:
            system_prompt = f"""
You are an expert data analyst specializing in prospect research and enrichment.
Analyze the provided prospect information and generate enriched data insights.

Prospect Information:
- Name: {request.name}
- Company: {request.company}
- Email: {request.email or 'Not provided'}
- LinkedIn: {request.linkedin_url or 'Not provided'}

Provide enriched insights in JSON format with:
- enriched_data: object containing:
  - estimated_company_size: "startup", "small", "medium", "large", "enterprise"
  - likely_budget_range: estimated budget category
  - decision_maker_level: "individual", "manager", "director", "vp", "c-level"
  - pain_points: list of likely challenges
  - preferred_communication: "email", "linkedin", "phone", "in-person"
  - best_contact_time: "morning", "afternoon", "evening"
  - industry_trends: relevant industry insights
- confidence_score: 0.0-1.0 based on available information
- data_sources: list of analysis methods used
- verification_status: "high", "medium", "low"
"""

            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Analyze and enrich this prospect data."}
                ],
                temperature=0.3,
                max_tokens=600
            )
            
            execution_time = time.time() - start_time
            
            # Parse response
            content = response.choices[0].message.content
            try:
                result_data = json.loads(content)
            except json.JSONDecodeError:
                # Fallback enrichment data
                result_data = {
                    "enriched_data": {
                        "estimated_company_size": "medium",
                        "likely_budget_range": "mid-market",
                        "decision_maker_level": "manager",
                        "pain_points": ["efficiency", "cost-optimization", "growth"],
                        "preferred_communication": "email",
                        "best_contact_time": "morning",
                        "industry_trends": ["digital transformation", "automation"]
                    },
                    "confidence_score": 0.6,
                    "data_sources": ["ai_analysis", "industry_patterns"],
                    "verification_status": "medium"
                }
            
            # Log the interaction
            await self._log_prompt_interaction(
                prompt_type="prospect_enrichment",
                input_data=request.dict(),
                output_data=result_data,
                execution_time=execution_time,
                token_usage=response.usage.dict() if hasattr(response, 'usage') else {}
            )
            
            return ProspectEnrichmentResponse(**result_data)
            
        except Exception as e:
            logger.error(f"Error enriching prospect data: {e}")
            execution_time = time.time() - start_time
            
            # Log the error
            await self._log_prompt_interaction(
                prompt_type="prospect_enrichment",
                input_data=request.dict(),
                output_data={"error": str(e)},
                execution_time=execution_time,
                success=False,
                error_message=str(e)
            )
            
            # Return fallback response
            return ProspectEnrichmentResponse(
                enriched_data={
                    "estimated_company_size": "unknown",
                    "likely_budget_range": "unknown",
                    "decision_maker_level": "unknown",
                    "pain_points": ["general business challenges"],
                    "preferred_communication": "email",
                    "best_contact_time": "morning",
                    "industry_trends": ["market competition"]
                },
                confidence_score=0.3,
                data_sources=["fallback_analysis"],
                verification_status="low"
            )
    
    async def _log_prompt_interaction(
        self,
        prompt_type: str,
        input_data: Dict,
        output_data: Dict,
        execution_time: float,
        token_usage: Dict = None,
        success: bool = True,
        error_message: str = None
    ):
        """Log prompt interaction to database"""
        try:
            from database import database
            
            log_data = {
                "id": str(time.time()),  # Simple ID for now
                "prompt_type": prompt_type,
                "model_name": self.model,
                "input_data": input_data,
                "output_data": output_data,
                "execution_time": execution_time,
                "token_usage": token_usage or {},
                "success": success,
                "error_message": error_message
            }
            
            query = """
                INSERT INTO prompt_logs (id, prompt_type, model_name, input_data, output_data, 
                                       execution_time, token_usage, success, error_message, created_at)
                VALUES (:id, :prompt_type, :model_name, :input_data, :output_data, 
                       :execution_time, :token_usage, :success, :error_message, NOW())
            """
            
            await database.execute(query, log_data)
            
        except Exception as e:
            logger.error(f"Failed to log prompt interaction: {e}")

# Global OpenAI service instance
openai_service = OpenAIService()