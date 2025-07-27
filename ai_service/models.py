"""
Pydantic models for AI service request/response validation
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
from enum import Enum

class MessageTone(str, Enum):
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    FRIENDLY = "friendly"
    EXECUTIVE = "executive"

class MessageLength(str, Enum):
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"

class PersonalizationLevel(str, Enum):
    BASIC = "basic"
    MODERATE = "moderate"
    HYPER_PERSONALIZED = "hyper-personalized"

class TemplateType(str, Enum):
    COLD_EMAIL = "cold-email"
    LINKEDIN = "linkedin"
    FOLLOW_UP = "follow-up"
    DEMO_REQUEST = "demo-request"

# Request Models
class ProspectData(BaseModel):
    name: str = Field(..., description="Full name of the prospect")
    title: Optional[str] = Field(None, description="Job title")
    company: Optional[str] = Field(None, description="Company name")
    industry: Optional[str] = Field(None, description="Industry sector")
    email: Optional[str] = Field(None, description="Email address")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="Geographic location")
    company_size: Optional[str] = Field(None, description="Company size")
    technologies: Optional[List[str]] = Field(None, description="Technologies used")
    recent_news: Optional[List[str]] = Field(None, description="Recent company news")

class CampaignContext(BaseModel):
    product_name: str = Field(..., description="Product or service name")
    product_description: str = Field(..., description="Product description")
    value_proposition: str = Field(..., description="Main value proposition")
    call_to_action: str = Field(..., description="Desired call to action")
    company_info: Optional[str] = Field(None, description="Company background")

class MessageOptions(BaseModel):
    tone: MessageTone = Field(default=MessageTone.PROFESSIONAL, description="Message tone")
    length: MessageLength = Field(default=MessageLength.MEDIUM, description="Message length")
    personalization_level: PersonalizationLevel = Field(default=PersonalizationLevel.HYPER_PERSONALIZED, description="Level of personalization")
    include_data_points: Optional[List[str]] = Field(None, description="Specific data points to include")
    template_type: TemplateType = Field(default=TemplateType.COLD_EMAIL, description="Template type")
    include_social_proof: bool = Field(default=True, description="Include social proof")
    max_variants: int = Field(default=3, description="Maximum number of variants to generate")

class MessageGenerationRequest(BaseModel):
    prospect: ProspectData = Field(..., description="Prospect information")
    campaign_context: CampaignContext = Field(..., description="Campaign context")
    message_options: MessageOptions = Field(..., description="Message generation options")
    user_id: Optional[str] = Field(None, description="User ID for logging")

class ProspectEnrichmentRequest(BaseModel):
    prospect: ProspectData = Field(..., description="Basic prospect information")
    enrichment_sources: Optional[List[str]] = Field(None, description="Data sources to use")
    user_id: Optional[str] = Field(None, description="User ID for logging")

# Response Models
class MessageVariant(BaseModel):
    id: str = Field(..., description="Variant ID")
    subject: str = Field(..., description="Email subject line")
    content: str = Field(..., description="Message content")
    personalization_score: float = Field(..., ge=0, le=1, description="Personalization score (0-1)")
    confidence: float = Field(..., ge=0, le=1, description="AI confidence score (0-1)")
    cta_strength: float = Field(..., ge=0, le=1, description="Call-to-action strength (0-1)")
    estimated_response_rate: float = Field(..., ge=0, le=1, description="Estimated response rate")
    variant_type: str = Field(..., description="Type of variant (original, shorter, alternative)")

class PersonalizationPoint(BaseModel):
    type: str = Field(..., description="Type of personalization")
    value: str = Field(..., description="Personalized value")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in this personalization")
    source: str = Field(..., description="Data source")

class MessageMetadata(BaseModel):
    personalization_points: List[PersonalizationPoint] = Field(..., description="Personalization details")
    data_sources_used: List[str] = Field(..., description="Data sources utilized")
    generation_time_ms: int = Field(..., description="Generation time in milliseconds")
    model_used: str = Field(..., description="AI model used")
    prompt_tokens: Optional[int] = Field(None, description="Tokens used in prompt")
    completion_tokens: Optional[int] = Field(None, description="Tokens in completion")

class MessageGenerationResponse(BaseModel):
    id: str = Field(..., description="Response ID")
    variants: List[MessageVariant] = Field(..., description="Generated message variants")
    metadata: MessageMetadata = Field(..., description="Generation metadata")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")

class EnrichedData(BaseModel):
    company_description: Optional[str] = Field(None, description="Company description")
    recent_funding: Optional[Dict[str, Any]] = Field(None, description="Recent funding information")
    key_executives: Optional[List[Dict[str, str]]] = Field(None, description="Key executives")
    technologies_used: Optional[List[str]] = Field(None, description="Technologies used")
    company_news: Optional[List[str]] = Field(None, description="Recent company news")
    social_media_activity: Optional[Dict[str, Any]] = Field(None, description="Social media insights")
    intent_signals: Optional[Dict[str, Any]] = Field(None, description="Buying intent signals")

class ProspectEnrichmentResponse(BaseModel):
    id: str = Field(..., description="Response ID")
    enriched_data: EnrichedData = Field(..., description="Enriched prospect data")
    confidence: float = Field(..., ge=0, le=1, description="Overall confidence score")
    data_quality_score: float = Field(..., ge=0, le=1, description="Data quality score")
    enrichment_sources: List[str] = Field(..., description="Sources used for enrichment")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")

# Admin/Logging Models
class PromptLog(BaseModel):
    id: Optional[str] = Field(None, description="Log ID")
    prompt_type: str = Field(..., description="Type of prompt")
    model_used: str = Field(..., description="AI model used")
    input_data: Dict[str, Any] = Field(..., description="Input data")
    output_data: Dict[str, Any] = Field(..., description="Output data")
    user_id: Optional[str] = Field(None, description="User ID")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    execution_time_ms: Optional[int] = Field(None, description="Execution time in milliseconds")
    token_usage: Optional[Dict[str, int]] = Field(None, description="Token usage statistics")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class AdminDashboardResponse(BaseModel):
    total_prompts: int = Field(..., description="Total number of prompts")
    prompts_today: int = Field(..., description="Prompts sent today")
    average_execution_time: float = Field(..., description="Average execution time")
    top_models: List[Dict[str, Any]] = Field(..., description="Most used models")
    recent_prompts: List[PromptLog] = Field(..., description="Recent prompt logs")
    error_rate: float = Field(..., ge=0, le=1, description="Error rate")
    total_tokens_used: int = Field(..., description="Total tokens consumed")

class PromptFilterRequest(BaseModel):
    start_date: Optional[datetime] = Field(None, description="Start date filter")
    end_date: Optional[datetime] = Field(None, description="End date filter")
    prompt_type: Optional[str] = Field(None, description="Filter by prompt type")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    model_used: Optional[str] = Field(None, description="Filter by model")
    limit: int = Field(default=100, le=1000, description="Number of results to return")
    offset: int = Field(default=0, description="Offset for pagination")