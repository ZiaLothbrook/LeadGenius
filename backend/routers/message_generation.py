"""
CARD-008: AI Message Generation Router
FastAPI router for AI-powered message generation with advanced personalization
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import logging
from datetime import datetime

from routers.auth import get_current_user
from services.message_generation_engine import (
    message_generation_engine,
    MessageGenerationRequest,
    MessageGenerationResponse,
    MessageTone,
    MessageType
)
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/generate", response_model=MessageGenerationResponse)
async def generate_personalized_messages(
    request: MessageGenerationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    CARD-008: Generate personalized message variations
    
    Features:
    - 3 message variations per request
    - Advanced prompt engineering with context building
    - Personalization scoring >80%
    - Support for 4 tones (Professional, Casual, Friendly, Direct)
    - <5 seconds generation time
    - A/B testing framework
    - Nexus.ai branding integration
    """
    try:
        logger.info(f"🤖 Generating messages for prospect: {request.prospect_name}")
        start_time = datetime.now()
        
        # Generate personalized messages using the advanced engine
        response = await message_generation_engine.generate_personalized_message(request)
        
        # Log generation analytics
        await _log_message_generation(request, response, current_user["id"])
        
        generation_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"✅ Message generation completed in {generation_time:.2f}s")
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Message generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Message generation failed: {str(e)}"
        )

@router.post("/generate-batch")
async def generate_batch_messages(
    requests: List[MessageGenerationRequest],
    current_user: dict = Depends(get_current_user)
):
    """Generate messages for multiple prospects in batch"""
    try:
        logger.info(f"🚀 Starting batch generation for {len(requests)} prospects")
        
        results = []
        for request in requests:
            try:
                response = await message_generation_engine.generate_personalized_message(request)
                results.append({
                    "prospect_id": request.prospect_id,
                    "status": "success",
                    "response": response
                })
                await _log_message_generation(request, response, current_user["id"])
            except Exception as e:
                results.append({
                    "prospect_id": request.prospect_id,
                    "status": "error",
                    "error": str(e)
                })
        
        logger.info(f"✅ Batch generation completed: {len([r for r in results if r['status'] == 'success'])} successful")
        
        return {
            "total_processed": len(requests),
            "successful": len([r for r in results if r["status"] == "success"]),
            "failed": len([r for r in results if r["status"] == "error"]),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"❌ Batch generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch generation failed: {str(e)}"
        )

@router.get("/templates")
async def get_message_templates(current_user: dict = Depends(get_current_user)):
    """Get available message templates and configurations"""
    return {
        "tones": [
            {"value": "professional", "label": "Professional", "description": "Formal, business-focused communication"},
            {"value": "casual", "label": "Casual", "description": "Conversational, approachable tone"},
            {"value": "friendly", "label": "Friendly", "description": "Warm, relationship-building approach"},
            {"value": "direct", "label": "Direct", "description": "Clear, action-oriented communication"}
        ],
        "message_types": [
            {"value": "email", "label": "Email", "description": "Cold email outreach"},
            {"value": "linkedin", "label": "LinkedIn", "description": "LinkedIn connection request"},
            {"value": "sms", "label": "SMS", "description": "Text message outreach"},
            {"value": "follow_up", "label": "Follow-up", "description": "Follow-up message"}
        ],
        "personalization_tips": [
            "Include company-specific details",
            "Reference recent news or achievements",
            "Mention mutual connections when available",
            "Use industry-relevant terminology",
            "Connect value proposition to their challenges"
        ]
    }

@router.get("/analytics/{prospect_id}")
async def get_message_analytics(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get message generation analytics for a specific prospect"""
    try:
        db = await get_database()
        
        # Get message generation history
        query = """
        SELECT 
            generation_time_ms,
            personalization_score,
            tone,
            message_type,
            variations_count,
            created_at
        FROM message_generations 
        WHERE prospect_id = :prospect_id AND user_id = :user_id
        ORDER BY created_at DESC
        LIMIT 10
        """
        
        results = await db.fetch_all(
            query, 
            {"prospect_id": prospect_id, "user_id": current_user["id"]}
        )
        
        if not results:
            return {
                "prospect_id": prospect_id,
                "total_generations": 0,
                "avg_personalization_score": 0,
                "avg_generation_time": 0,
                "history": []
            }
        
        # Calculate analytics
        total_generations = len(results)
        avg_personalization = sum(r["personalization_score"] for r in results) / total_generations
        avg_generation_time = sum(r["generation_time_ms"] for r in results) / total_generations
        
        return {
            "prospect_id": prospect_id,
            "total_generations": total_generations,
            "avg_personalization_score": round(avg_personalization, 2),
            "avg_generation_time": round(avg_generation_time),
            "history": [dict(r) for r in results]
        }
        
    except Exception as e:
        logger.error(f"❌ Analytics query failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analytics query failed: {str(e)}"
        )

@router.get("/performance")
async def get_performance_metrics(current_user: dict = Depends(get_current_user)):
    """Get overall message generation performance metrics"""
    try:
        db = await get_database()
        
        # Get performance metrics
        query = """
        SELECT 
            COUNT(*) as total_generations,
            AVG(generation_time_ms) as avg_generation_time,
            AVG(personalization_score) as avg_personalization_score,
            COUNT(CASE WHEN personalization_score >= 80 THEN 1 END) as high_quality_messages,
            COUNT(DISTINCT prospect_id) as unique_prospects
        FROM message_generations 
        WHERE user_id = :user_id AND created_at >= NOW() - INTERVAL '30 days'
        """
        
        result = await db.fetch_one(query, {"user_id": current_user["id"]})
        
        if not result or result["total_generations"] == 0:
            return {
                "total_generations": 0,
                "avg_generation_time": 0,
                "avg_personalization_score": 0,
                "quality_rate": 0,
                "unique_prospects": 0
            }
        
        quality_rate = (result["high_quality_messages"] / result["total_generations"]) * 100
        
        return {
            "total_generations": result["total_generations"],
            "avg_generation_time": round(result["avg_generation_time"]),
            "avg_personalization_score": round(result["avg_personalization_score"], 2),
            "quality_rate": round(quality_rate, 2),
            "unique_prospects": result["unique_prospects"]
        }
        
    except Exception as e:
        logger.error(f"❌ Performance metrics query failed: {str(e)}")
        return {
            "total_generations": 0,
            "avg_generation_time": 0,
            "avg_personalization_score": 0,
            "quality_rate": 0,
            "unique_prospects": 0
        }

@router.post("/test-generation")
async def test_message_generation(current_user: dict = Depends(get_current_user)):
    """Test message generation with sample data"""
    try:
        # Create test request
        test_request = MessageGenerationRequest(
            prospect_id="test-123",
            prospect_name="John Smith",
            prospect_company="TechCorp Inc",
            prospect_title="VP of Engineering",
            prospect_industry="technology",
            prospect_location="San Francisco, CA",
            campaign_goal="Increase qualified leads for AI platform",
            message_type=MessageType.EMAIL,
            tone=MessageTone.PROFESSIONAL,
            additional_context="Company recently raised Series B funding"
        )
        
        # Generate test messages
        response = await message_generation_engine.generate_personalized_message(test_request)
        
        return {
            "status": "success",
            "test_data": test_request.dict(),
            "generation_result": response,
            "message": "Message generation engine is working correctly"
        }
        
    except Exception as e:
        logger.error(f"❌ Test generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Test generation failed: {str(e)}"
        )

async def _log_message_generation(
    request: MessageGenerationRequest,
    response: MessageGenerationResponse,
    user_id: str
):
    """Log message generation for analytics"""
    try:
        db = await get_database()
        
        # Calculate average personalization score
        avg_personalization = sum(v.personalization_score for v in response.variations) / len(response.variations)
        
        query = """
        INSERT INTO message_generations (
            id, user_id, prospect_id, prospect_name, prospect_company,
            tone, message_type, campaign_goal, variations_count,
            generation_time_ms, personalization_score, created_at
        ) VALUES (
            :id, :user_id, :prospect_id, :prospect_name, :prospect_company,
            :tone, :message_type, :campaign_goal, :variations_count,
            :generation_time_ms, :personalization_score, NOW()
        )
        """
        
        await db.execute(query, {
            "id": f"msg_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{request.prospect_id}",
            "user_id": user_id,
            "prospect_id": request.prospect_id,
            "prospect_name": request.prospect_name,
            "prospect_company": request.prospect_company,
            "tone": request.tone.value,
            "message_type": request.message_type.value,
            "campaign_goal": request.campaign_goal,
            "variations_count": len(response.variations),
            "generation_time_ms": response.generation_time_ms,
            "personalization_score": avg_personalization
        })
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to log message generation: {str(e)}")