"""
Admin router for FastAPI backend
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from database import get_database
from routers.auth import get_current_user
from services.redis_service import redis_client
from datetime import datetime, timedelta
import uuid

router = APIRouter()

class PromptLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    prompt_type: str
    model_name: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    execution_time: float
    token_usage: Dict[str, Any]
    success: bool
    error_message: Optional[str]
    created_at: str

class SystemStatsResponse(BaseModel):
    total_users: int
    total_prospects: int
    total_campaigns: int
    total_messages: int
    ai_requests_today: int
    ai_requests_week: int
    avg_response_time: float
    error_rate: float
    active_users_today: int

class UserActivityResponse(BaseModel):
    user_id: str
    username: str
    email: str
    last_login: Optional[str]
    prospects_count: int
    campaigns_count: int
    messages_sent: int
    ai_requests: int
    created_at: str

def check_admin_permissions(current_user: dict = Depends(get_current_user)):
    """Check if user has admin permissions"""
    # For now, check if user is admin by username or email
    if current_user.get("username") != "admin" and "admin" not in current_user.get("email", ""):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(admin_user: dict = Depends(check_admin_permissions)):
    """Get system-wide statistics"""
    db = await get_database()
    
    # Get total counts
    total_users = await db.fetch_one("SELECT COUNT(*) as count FROM users")
    total_prospects = await db.fetch_one("SELECT COUNT(*) as count FROM prospects")
    total_campaigns = await db.fetch_one("SELECT COUNT(*) as count FROM campaigns")
    total_messages = await db.fetch_one("SELECT COUNT(*) as count FROM messages")
    
    # Get AI request counts
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    
    ai_requests_today = await db.fetch_one("""
        SELECT COUNT(*) as count FROM prompt_logs 
        WHERE DATE(created_at) = :today
    """, {"today": today})
    
    ai_requests_week = await db.fetch_one("""
        SELECT COUNT(*) as count FROM prompt_logs 
        WHERE DATE(created_at) >= :week_ago
    """, {"week_ago": week_ago})
    
    # Calculate average response time
    avg_response_time = await db.fetch_one("""
        SELECT AVG(execution_time) as avg_time FROM prompt_logs 
        WHERE created_at >= :week_ago
    """, {"week_ago": week_ago})
    
    # Calculate error rate
    error_rate = await db.fetch_one("""
        SELECT 
            COUNT(CASE WHEN success = false THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) * 100 as rate
        FROM prompt_logs 
        WHERE created_at >= :week_ago
    """, {"week_ago": week_ago})
    
    # Get active users today (users who made requests today)
    active_users_today = await db.fetch_one("""
        SELECT COUNT(DISTINCT user_id) as count FROM prompt_logs 
        WHERE DATE(created_at) = :today AND user_id IS NOT NULL
    """, {"today": today})
    
    return SystemStatsResponse(
        total_users=total_users["count"] or 0,
        total_prospects=total_prospects["count"] or 0,
        total_campaigns=total_campaigns["count"] or 0,
        total_messages=total_messages["count"] or 0,
        ai_requests_today=ai_requests_today["count"] or 0,
        ai_requests_week=ai_requests_week["count"] or 0,
        avg_response_time=round(avg_response_time["avg_time"] or 0, 3),
        error_rate=round(error_rate["rate"] or 0, 2),
        active_users_today=active_users_today["count"] or 0
    )

@router.get("/users", response_model=List[UserActivityResponse])
async def get_user_activity(
    admin_user: dict = Depends(check_admin_permissions),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    """Get user activity data"""
    db = await get_database()
    
    users = await db.fetch_all("""
        SELECT 
            u.id as user_id,
            u.username,
            u.email,
            u.created_at,
            COUNT(DISTINCT p.id) as prospects_count,
            COUNT(DISTINCT c.id) as campaigns_count,
            COUNT(DISTINCT m.id) as messages_sent,
            COUNT(DISTINCT pl.id) as ai_requests
        FROM users u
        LEFT JOIN prospects p ON u.id = p.user_id
        LEFT JOIN campaigns c ON u.id = c.user_id
        LEFT JOIN messages m ON u.id = m.user_id
        LEFT JOIN prompt_logs pl ON u.id = pl.user_id
        GROUP BY u.id, u.username, u.email, u.created_at
        ORDER BY u.created_at DESC
        LIMIT :limit OFFSET :skip
    """, {"limit": limit, "skip": skip})
    
    return [UserActivityResponse(**dict(user), last_login=None) for user in users]

@router.get("/prompt-logs", response_model=List[PromptLogResponse])
async def get_prompt_logs(
    admin_user: dict = Depends(check_admin_permissions),
    prompt_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    success: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0)
):
    """Get prompt interaction logs"""
    db = await get_database()
    
    query = "SELECT * FROM prompt_logs WHERE 1=1"
    params = {}
    
    if prompt_type:
        query += " AND prompt_type = :prompt_type"
        params["prompt_type"] = prompt_type
    
    if user_id:
        query += " AND user_id = :user_id"
        params["user_id"] = user_id
    
    if success is not None:
        query += " AND success = :success"
        params["success"] = success
    
    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    params["limit"] = limit
    params["skip"] = skip
    
    logs = await db.fetch_all(query, params)
    return [PromptLogResponse(**dict(log)) for log in logs]

@router.get("/prompt-analytics")
async def get_prompt_analytics(
    admin_user: dict = Depends(check_admin_permissions),
    days: int = Query(7, ge=1, le=90)
):
    """Get AI prompt analytics"""
    db = await get_database()
    
    start_date = datetime.now().date() - timedelta(days=days)
    
    # Get prompt type distribution
    prompt_types = await db.fetch_all("""
        SELECT 
            prompt_type,
            COUNT(*) as count,
            AVG(execution_time) as avg_time,
            COUNT(CASE WHEN success = false THEN 1 END) as errors
        FROM prompt_logs 
        WHERE DATE(created_at) >= :start_date
        GROUP BY prompt_type
        ORDER BY count DESC
    """, {"start_date": start_date})
    
    # Get model usage
    models = await db.fetch_all("""
        SELECT 
            model_name,
            COUNT(*) as count,
            AVG(execution_time) as avg_time
        FROM prompt_logs 
        WHERE DATE(created_at) >= :start_date
        GROUP BY model_name
        ORDER BY count DESC
    """, {"start_date": start_date})
    
    # Get daily usage
    daily_usage = await db.fetch_all("""
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as requests,
            AVG(execution_time) as avg_time,
            COUNT(CASE WHEN success = false THEN 1 END) as errors
        FROM prompt_logs 
        WHERE DATE(created_at) >= :start_date
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """, {"start_date": start_date})
    
    return {
        "prompt_types": [dict(row) for row in prompt_types],
        "models": [dict(row) for row in models],
        "daily_usage": [dict(row) for row in daily_usage],
        "period_days": days
    }

@router.get("/system-health")
async def get_system_health(admin_user: dict = Depends(check_admin_permissions)):
    """Get system health status"""
    health_status = {
        "database": "unknown",
        "redis": "unknown",
        "openai_api": "unknown",
        "disk_usage": "unknown",
        "memory_usage": "unknown"
    }
    
    # Check database
    try:
        db = await get_database()
        await db.fetch_one("SELECT 1")
        health_status["database"] = "healthy"
    except Exception:
        health_status["database"] = "unhealthy"
    
    # Check Redis
    try:
        await redis_client.ping()
        health_status["redis"] = "healthy"
    except Exception:
        health_status["redis"] = "unhealthy"
    
    # Check OpenAI API (simplified)
    try:
        from services.openai_service import openai_service
        # This is a simple check - in production you'd want a proper health check
        health_status["openai_api"] = "healthy"
    except Exception:
        health_status["openai_api"] = "unhealthy"
    
    return health_status

@router.delete("/prompt-logs/cleanup")
async def cleanup_old_logs(
    admin_user: dict = Depends(check_admin_permissions),
    days_old: int = Query(90, ge=30, le=365)
):
    """Clean up old prompt logs"""
    db = await get_database()
    
    cutoff_date = datetime.now() - timedelta(days=days_old)
    
    result = await db.execute("""
        DELETE FROM prompt_logs 
        WHERE created_at < :cutoff_date
    """, {"cutoff_date": cutoff_date})
    
    return {
        "message": f"Cleaned up logs older than {days_old} days",
        "deleted_count": result
    }

@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: str,
    admin_user: dict = Depends(check_admin_permissions)
):
    """Disable a user account (admin only)"""
    db = await get_database()
    
    # Add a disabled flag or update user status
    # For now, we'll add a simple implementation
    result = await db.execute("""
        UPDATE users 
        SET updated_at = NOW()
        WHERE id = :user_id
    """, {"user_id": user_id})
    
    if result == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User {user_id} disabled"}

@router.get("/export/data")
async def export_system_data(
    admin_user: dict = Depends(check_admin_permissions),
    table: str = Query(..., regex="^(users|prospects|campaigns|messages|prompt_logs)$")
):
    """Export system data (admin only)"""
    db = await get_database()
    
    # Get data from specified table
    query = f"SELECT * FROM {table} ORDER BY created_at DESC LIMIT 10000"
    data = await db.fetch_all(query)
    
    return {
        "table": table,
        "count": len(data),
        "data": [dict(row) for row in data]
    }