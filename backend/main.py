"""
FastAPI Backend for AI Lead Generation Platform
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
import uvicorn
from database import database, engine
from models import Base
from routers import auth, prospects, campaigns, analytics, admin, message_generation
from services.redis_service import redis_client
from services.celery_app import celery_app
import redis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting AI Lead Generation Platform API")
    await database.connect()
    
    # Test Redis connection
    try:
        await redis_client.ping()
        logger.info("✅ Redis connection established")
    except redis.ConnectionError:
        logger.warning("⚠️ Redis connection failed - caching disabled")
    
    # Test Celery connection
    try:
        celery_app.control.inspect().stats()
        logger.info("✅ Celery worker connection established")
    except Exception:
        logger.warning("⚠️ Celery worker connection failed - background tasks disabled")
    
    yield
    
    # Shutdown
    await database.disconnect()
    logger.info("Shutting down AI Lead Generation Platform API")

# Initialize FastAPI app
app = FastAPI(
    title="AI Lead Generation Platform",
    description="Comprehensive AI-powered lead generation and outreach platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security scheme
security = HTTPBearer()

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(prospects.router, prefix="/api/prospects", tags=["Prospects"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(message_generation.router, prefix="/api/messages", tags=["AI Message Generation"])

@app.get("/")
async def root():
    """Root endpoint - redirect to docs"""
    return RedirectResponse(url="/docs")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database
        await database.fetch_one("SELECT 1")
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"
    
    try:
        # Check Redis
        await redis_client.ping()
        redis_status = "healthy"
    except Exception:
        redis_status = "unhealthy"
    
    return {
        "status": "healthy",
        "database": db_status,
        "redis": redis_status,
        "version": "2.0.0"
    }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Get total prospects
        total_prospects_query = "SELECT COUNT(*) as count FROM prospects"
        total_prospects_result = await database.fetch_one(total_prospects_query)
        total_prospects = total_prospects_result["count"] if total_prospects_result else 0
        
        # Get active campaigns
        active_campaigns_query = "SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'"
        active_campaigns_result = await database.fetch_one(active_campaigns_query)
        active_campaigns = active_campaigns_result["count"] if active_campaigns_result else 0
        
        # Get total messages
        total_messages_query = "SELECT COUNT(*) as count FROM messages"
        total_messages_result = await database.fetch_one(total_messages_query)
        total_messages = total_messages_result["count"] if total_messages_result else 0
        
        # Get open rate (mock data for now)
        open_rate = "24.3%"
        
        return {
            "totalProspects": str(total_prospects),
            "activeCampaigns": str(active_campaigns),
            "totalMessages": str(total_messages),
            "openRate": open_rate
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return {
            "totalProspects": "0",
            "activeCampaigns": "0", 
            "totalMessages": "0",
            "openRate": "0%"
        }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )