"""
Prospects router for FastAPI backend
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
from database import get_database
from routers.auth import get_current_user
from services.openai_service import openai_service, ProspectEnrichmentRequest
from services.redis_service import redis_client, cache_key
from services.search_engine import search_engine
from models.search import SearchRequest, SearchResponse
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ProspectCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: str
    title: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    data_source: Optional[str] = "manual"
    notes: Optional[str] = None

class ProspectUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    score: Optional[int] = None
    verified: Optional[bool] = None
    notes: Optional[str] = None

class ProspectResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: str
    title: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    score: int = 0
    verified: bool = False
    data_source: str = "manual"
    data_quality: int = 50
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

@router.get("", response_model=List[ProspectResponse])
async def get_prospects(
    current_user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    verified: Optional[bool] = Query(None)
):
    """Get prospects for the current user with optional filtering"""
    db = await get_database()
    
    # Build query with filters
    query = "SELECT * FROM prospects WHERE user_id = :user_id"
    params = {"user_id": current_user["id"]}
    
    if search:
        query += " AND (name ILIKE :search OR company ILIKE :search OR email ILIKE :search)"
        params["search"] = f"%{search}%"
    
    if industry:
        query += " AND industry = :industry"
        params["industry"] = industry
    
    if location:
        query += " AND location ILIKE :location"
        params["location"] = f"%{location}%"
    
    if verified is not None:
        query += " AND verified = :verified"
        params["verified"] = verified
    
    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    params["limit"] = limit
    params["skip"] = skip
    
    prospects = await db.fetch_all(query, params)
    return [ProspectResponse(**dict(prospect)) for prospect in prospects]

@router.get("/{prospect_id}", response_model=ProspectResponse)
async def get_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific prospect by ID"""
    db = await get_database()
    
    prospect = await db.fetch_one(
        "SELECT * FROM prospects WHERE id = :id AND user_id = :user_id",
        {"id": prospect_id, "user_id": current_user["id"]}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return ProspectResponse(**dict(prospect))

@router.post("", response_model=ProspectResponse)
async def create_prospect(
    prospect_data: ProspectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new prospect"""
    db = await get_database()
    
    prospect_id = str(uuid.uuid4())
    
    query = """
        INSERT INTO prospects (
            id, user_id, name, email, phone, company, title, industry, 
            location, linkedin_url, website_url, data_source, notes, 
            score, verified, data_quality, created_at, updated_at
        )
        VALUES (
            :id, :user_id, :name, :email, :phone, :company, :title, :industry,
            :location, :linkedin_url, :website_url, :data_source, :notes,
            :score, :verified, :data_quality, NOW(), NOW()
        )
        RETURNING *
    """
    
    prospect = await db.fetch_one(query, {
        "id": prospect_id,
        "user_id": current_user["id"],
        "score": 0,
        "verified": False,
        "data_quality": 50,
        **prospect_data.dict()
    })
    
    return ProspectResponse(**dict(prospect))

@router.put("/{prospect_id}", response_model=ProspectResponse)
async def update_prospect(
    prospect_id: str,
    prospect_data: ProspectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing prospect"""
    db = await get_database()
    
    # Check if prospect exists and belongs to user
    existing = await db.fetch_one(
        "SELECT id FROM prospects WHERE id = :id AND user_id = :user_id",
        {"id": prospect_id, "user_id": current_user["id"]}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Build update query dynamically
    update_fields = []
    params = {"id": prospect_id, "user_id": current_user["id"]}
    
    for field, value in prospect_data.dict(exclude_unset=True).items():
        if value is not None:
            update_fields.append(f"{field} = :{field}")
            params[field] = value
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields.append("updated_at = NOW()")
    
    query = f"""
        UPDATE prospects 
        SET {', '.join(update_fields)}
        WHERE id = :id AND user_id = :user_id
        RETURNING *
    """
    
    prospect = await db.fetch_one(query, params)
    return ProspectResponse(**dict(prospect))

@router.delete("/{prospect_id}")
async def delete_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a prospect"""
    db = await get_database()
    
    result = await db.execute(
        "DELETE FROM prospects WHERE id = :id AND user_id = :user_id",
        {"id": prospect_id, "user_id": current_user["id"]}
    )
    
    if result == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"message": "Prospect deleted successfully"}

@router.post("/search", response_model=SearchResponse)
async def search_prospects(
    search_request: SearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    CARD-007: Comprehensive multi-source prospect search engine
    
    Features:
    - Multi-source data aggregation (Apollo.io + Database)
    - Advanced filtering and sorting
    - AI-powered ranking and scoring
    - Duplicate detection and merging
    - Search analytics and optimization
    - Performance optimization with caching
    """
    try:
        # Execute comprehensive search using the search engine
        search_result = await search_engine.search_prospects(
            request=search_request,
            user_id=current_user["id"]
        )
        
        return search_result
        
    except Exception as e:
        logger.error(f"❌ Prospect search failed: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Search failed: {str(e)}"
        )

@router.post("/{prospect_id}/enrich")
async def enrich_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enrich prospect data using AI"""
    db = await get_database()
    
    # Get prospect
    prospect = await db.fetch_one(
        "SELECT * FROM prospects WHERE id = :id AND user_id = :user_id",
        {"id": prospect_id, "user_id": current_user["id"]}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Check cache first
    cache_key_str = cache_key("prospect_enrichment", prospect_id)
    cached_result = await redis_client.get_json(cache_key_str)
    
    if cached_result:
        return cached_result
    
    # Enrich using AI
    enrichment_request = ProspectEnrichmentRequest(
        name=prospect["name"],
        company=prospect["company"],
        email=prospect["email"],
        linkedin_url=prospect["linkedin_url"]
    )
    
    enrichment_result = await openai_service.enrich_prospect_data(enrichment_request)
    
    # Update prospect with enriched data
    enriched_data = enrichment_result.enriched_data
    
    # Update score based on enrichment confidence
    new_score = int(enrichment_result.confidence_score * 100)
    
    await db.execute("""
        UPDATE prospects 
        SET score = :score, data_quality = :data_quality, updated_at = NOW()
        WHERE id = :id
    """, {
        "id": prospect_id,
        "score": new_score,
        "data_quality": int(enrichment_result.confidence_score * 100)
    })
    
    result = {
        "prospect_id": prospect_id,
        "enrichment_data": enriched_data,
        "confidence_score": enrichment_result.confidence_score,
        "verification_status": enrichment_result.verification_status,
        "updated_score": new_score
    }
    
    # Cache result for 1 hour
    await redis_client.set_json(cache_key_str, result, expire=3600)
    
    return result