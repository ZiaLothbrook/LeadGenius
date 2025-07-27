"""
FastAPI AI Service for Lead Generation Platform
Handles all AI operations with Pydantic validation and prompt logging
"""

import os
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .models import (
    MessageGenerationRequest,
    MessageGenerationResponse,
    ProspectEnrichmentRequest,
    ProspectEnrichmentResponse,
    PromptLog,
    AdminDashboardResponse
)
from .services.ai_client import AIClient
from .services.prompt_logger import PromptLogger
from .database import get_db, init_db
from .admin import admin_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and services on startup"""
    logger.info("🚀 Starting AI Service...")
    await init_db()
    logger.info("✅ AI Service initialized successfully")
    yield
    logger.info("🛑 Shutting down AI Service...")

# Initialize FastAPI app
app = FastAPI(
    title="AI Lead Generation Service",
    description="FastAPI service for AI-powered lead generation with Pydantic validation and prompt monitoring",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include admin router
app.include_router(admin_router, prefix="/admin", tags=["admin"])

# Initialize services
ai_client = AIClient()
prompt_logger = PromptLogger()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.post("/generate-message", response_model=MessageGenerationResponse)
async def generate_message(
    request: MessageGenerationRequest,
    db=Depends(get_db)
):
    """Generate personalized messages using AI with Pydantic validation"""
    try:
        logger.info(f"🎯 Generating message for prospect: {request.prospect.name}")
        
        # Generate the message using AI
        response = await ai_client.generate_personalized_message(request)
        
        # Log the prompt interaction
        await prompt_logger.log_prompt(
            db=db,
            prompt_type="message_generation",
            input_data=request.dict(),
            output_data=response.dict(),
            model_used=ai_client.get_default_model(),
            user_id=request.user_id,
            metadata={"prospect": request.prospect.name, "message_type": request.message_options.template_type}
        )
        
        logger.info(f"✅ Message generated successfully with {len(response.variants)} variants")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error generating message: {str(e)}")
        
        # Log the error
        await prompt_logger.log_prompt(
            db=db,
            prompt_type="message_generation_error",
            input_data=request.dict(),
            output_data={"error": str(e)},
            model_used=ai_client.get_default_model(),
            user_id=request.user_id,
            metadata={"error": True}
        )
        
        raise HTTPException(status_code=500, detail=f"Failed to generate message: {str(e)}")

@app.post("/enrich-prospect", response_model=ProspectEnrichmentResponse)
async def enrich_prospect(
    request: ProspectEnrichmentRequest,
    db=Depends(get_db)
):
    """Enrich prospect data using AI with confidence scoring"""
    try:
        logger.info(f"🔍 Enriching prospect: {request.prospect.name}")
        
        # Enrich the prospect using AI
        response = await ai_client.enrich_prospect_data(request)
        
        # Log the prompt interaction
        await prompt_logger.log_prompt(
            db=db,
            prompt_type="prospect_enrichment",
            input_data=request.dict(),
            output_data=response.dict(),
            model_used=ai_client.get_enrichment_model(),
            user_id=request.user_id,
            metadata={"prospect": request.prospect.name, "confidence": response.confidence}
        )
        
        logger.info(f"✅ Prospect enriched with confidence: {response.confidence}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error enriching prospect: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enrich prospect: {str(e)}")

@app.post("/analyze-intent", response_model=Dict[str, Any])
async def analyze_intent(
    request: Dict[str, Any],
    db=Depends(get_db)
):
    """Analyze prospect intent signals using AI"""
    try:
        logger.info("🧠 Analyzing intent signals...")
        
        # Analyze intent using AI
        response = await ai_client.analyze_intent_signals(request)
        
        # Log the prompt interaction
        await prompt_logger.log_prompt(
            db=db,
            prompt_type="intent_analysis",
            input_data=request,
            output_data=response,
            model_used=ai_client.get_default_model(),
            user_id=request.get("user_id"),
            metadata={"analysis_type": "intent_signals"}
        )
        
        logger.info("✅ Intent analysis completed")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error analyzing intent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze intent: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)