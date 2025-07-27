"""
Campaigns router for FastAPI backend
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from database import get_database
from routers.auth import get_current_user
from services.openai_service import openai_service, MessageGenerationRequest
from tasks.campaign_tasks import send_campaign_messages
import uuid

router = APIRouter()

class CampaignCreate(BaseModel):
    name: str
    type: str  # email, linkedin, phone, multi-channel
    subject: Optional[str] = None
    message_template: str
    goal: str
    tone: str  # professional, casual, friendly, direct
    prospect_ids: List[str]

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # draft, active, paused, completed
    subject: Optional[str] = None
    message_template: Optional[str] = None
    goal: Optional[str] = None
    tone: Optional[str] = None

class CampaignResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    subject: Optional[str]
    message_template: str
    goal: str
    tone: str
    total_prospects: int
    sent_count: int
    response_count: int
    scheduled_at: Optional[str]
    created_at: str
    updated_at: str

@router.get("", response_model=List[CampaignResponse])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    """Get campaigns for the current user"""
    db = await get_database()
    
    campaigns = await db.fetch_all(
        "SELECT * FROM campaigns WHERE user_id = :user_id ORDER BY created_at DESC",
        {"user_id": current_user["id"]}
    )
    
    return [CampaignResponse(**dict(campaign)) for campaign in campaigns]

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific campaign by ID"""
    db = await get_database()
    
    campaign = await db.fetch_one(
        "SELECT * FROM campaigns WHERE id = :id AND user_id = :user_id",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return CampaignResponse(**dict(campaign))

@router.post("", response_model=CampaignResponse)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new campaign"""
    db = await get_database()
    
    campaign_id = str(uuid.uuid4())
    
    # Create campaign
    campaign_query = """
        INSERT INTO campaigns (
            id, user_id, name, type, status, subject, message_template, 
            goal, tone, total_prospects, sent_count, response_count, created_at, updated_at
        )
        VALUES (
            :id, :user_id, :name, :type, :status, :subject, :message_template,
            :goal, :tone, :total_prospects, :sent_count, :response_count, NOW(), NOW()
        )
        RETURNING *
    """
    
    campaign = await db.fetch_one(campaign_query, {
        "id": campaign_id,
        "user_id": current_user["id"],
        "status": "draft",
        "total_prospects": len(campaign_data.prospect_ids),
        "sent_count": 0,
        "response_count": 0,
        **campaign_data.dict(exclude={"prospect_ids"})
    })
    
    # Add prospects to campaign
    for prospect_id in campaign_data.prospect_ids:
        await db.execute("""
            INSERT INTO campaign_prospects (id, campaign_id, prospect_id, status, created_at)
            VALUES (:id, :campaign_id, :prospect_id, :status, NOW())
        """, {
            "id": str(uuid.uuid4()),
            "campaign_id": campaign_id,
            "prospect_id": prospect_id,
            "status": "pending"
        })
    
    return CampaignResponse(**dict(campaign))

@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing campaign"""
    db = await get_database()
    
    # Check if campaign exists and belongs to user
    existing = await db.fetch_one(
        "SELECT id FROM campaigns WHERE id = :id AND user_id = :user_id",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Build update query dynamically
    update_fields = []
    params = {"id": campaign_id, "user_id": current_user["id"]}
    
    for field, value in campaign_data.dict(exclude_unset=True).items():
        if value is not None:
            update_fields.append(f"{field} = :{field}")
            params[field] = value
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields.append("updated_at = NOW()")
    
    query = f"""
        UPDATE campaigns 
        SET {', '.join(update_fields)}
        WHERE id = :id AND user_id = :user_id
        RETURNING *
    """
    
    campaign = await db.fetch_one(query, params)
    return CampaignResponse(**dict(campaign))

@router.post("/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Launch a campaign (start sending messages)"""
    db = await get_database()
    
    # Get campaign
    campaign = await db.fetch_one(
        "SELECT * FROM campaigns WHERE id = :id AND user_id = :user_id",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be launched")
    
    # Update campaign status
    await db.execute(
        "UPDATE campaigns SET status = 'active', updated_at = NOW() WHERE id = :id",
        {"id": campaign_id}
    )
    
    # Queue background task to send messages
    task = send_campaign_messages.delay(campaign_id)
    
    return {
        "message": "Campaign launched successfully",
        "task_id": task.id,
        "campaign_id": campaign_id
    }

@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause an active campaign"""
    db = await get_database()
    
    result = await db.execute(
        "UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = :id AND user_id = :user_id AND status = 'active'",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if result == 0:
        raise HTTPException(status_code=404, detail="Active campaign not found")
    
    return {"message": "Campaign paused successfully"}

@router.get("/{campaign_id}/prospects")
async def get_campaign_prospects(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get prospects associated with a campaign"""
    db = await get_database()
    
    # Verify campaign ownership
    campaign = await db.fetch_one(
        "SELECT id FROM campaigns WHERE id = :id AND user_id = :user_id",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get campaign prospects with prospect details
    prospects = await db.fetch_all("""
        SELECT cp.*, p.name, p.email, p.company, p.title, p.industry
        FROM campaign_prospects cp
        JOIN prospects p ON cp.prospect_id = p.id
        WHERE cp.campaign_id = :campaign_id
        ORDER BY cp.created_at DESC
    """, {"campaign_id": campaign_id})
    
    return [dict(prospect) for prospect in prospects]

@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a campaign"""
    db = await get_database()
    
    # Delete campaign prospects first (foreign key constraint)
    await db.execute(
        "DELETE FROM campaign_prospects WHERE campaign_id = :campaign_id",
        {"campaign_id": campaign_id}
    )
    
    # Delete campaign
    result = await db.execute(
        "DELETE FROM campaigns WHERE id = :id AND user_id = :user_id",
        {"id": campaign_id, "user_id": current_user["id"]}
    )
    
    if result == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign deleted successfully"}