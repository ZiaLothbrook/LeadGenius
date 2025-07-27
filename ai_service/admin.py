"""
Admin dashboard for monitoring LLM prompts and system interactions
"""

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminDashboardResponse, PromptLog, PromptFilterRequest
from .services.prompt_logger import PromptLogger

admin_router = APIRouter()
prompt_logger = PromptLogger()

@admin_router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(db: Session = Depends(get_db)):
    """Get admin dashboard with LLM usage statistics"""
    try:
        # Get dashboard statistics
        stats = await prompt_logger.get_dashboard_stats(db)
        
        # Get recent prompts
        recent_prompts = await prompt_logger.get_prompt_logs(
            db=db,
            limit=10,
            offset=0
        )
        
        return AdminDashboardResponse(
            total_prompts=stats['total_prompts'],
            prompts_today=stats['prompts_today'],
            average_execution_time=stats['average_execution_time'],
            top_models=stats['top_models'],
            recent_prompts=recent_prompts,
            error_rate=stats['error_rate'],
            total_tokens_used=stats['total_tokens_used']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")

@admin_router.get("/prompts", response_model=List[PromptLog])
async def get_prompt_logs(
    limit: int = Query(100, le=1000, description="Number of logs to return"),
    offset: int = Query(0, description="Offset for pagination"),
    prompt_type: Optional[str] = Query(None, description="Filter by prompt type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    model_used: Optional[str] = Query(None, description="Filter by model"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    db: Session = Depends(get_db)
):
    """Get filtered prompt logs for admin review"""
    try:
        return await prompt_logger.get_prompt_logs(
            db=db,
            limit=limit,
            offset=offset,
            prompt_type=prompt_type,
            user_id=user_id,
            model_used=model_used,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt logs: {str(e)}")

@admin_router.get("/prompts/{prompt_id}", response_model=PromptLog)
async def get_prompt_details(
    prompt_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific prompt"""
    try:
        logs = await prompt_logger.get_prompt_logs(
            db=db,
            limit=1,
            offset=0
        )
        
        # Find the specific prompt
        for log in logs:
            if log.id == prompt_id:
                return log
        
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt details: {str(e)}")

@admin_router.get("/analytics/usage")
async def get_usage_analytics(
    days: int = Query(7, le=30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get detailed usage analytics for the specified time period"""
    try:
        from sqlalchemy import func, text
        from ..database import PromptLogTable
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Daily usage statistics
        daily_stats = db.query(
            func.date(PromptLogTable.created_at).label('date'),
            func.count(PromptLogTable.id).label('total_prompts'),
            func.avg(PromptLogTable.execution_time_ms).label('avg_execution_time'),
            func.count(func.distinct(PromptLogTable.user_id)).label('unique_users')
        ).filter(
            PromptLogTable.created_at >= start_date,
            PromptLogTable.created_at <= end_date
        ).group_by(func.date(PromptLogTable.created_at)).order_by(text('date')).all()
        
        # Prompt type distribution
        prompt_types = db.query(
            PromptLogTable.prompt_type,
            func.count(PromptLogTable.id).label('count')
        ).filter(
            PromptLogTable.created_at >= start_date,
            PromptLogTable.created_at <= end_date
        ).group_by(PromptLogTable.prompt_type).order_by(text('count DESC')).all()
        
        # Model usage distribution
        model_usage = db.query(
            PromptLogTable.model_used,
            func.count(PromptLogTable.id).label('count'),
            func.avg(PromptLogTable.execution_time_ms).label('avg_time')
        ).filter(
            PromptLogTable.created_at >= start_date,
            PromptLogTable.created_at <= end_date
        ).group_by(PromptLogTable.model_used).order_by(text('count DESC')).all()
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "daily_stats": [
                {
                    "date": stat.date.isoformat(),
                    "total_prompts": stat.total_prompts,
                    "avg_execution_time": float(stat.avg_execution_time or 0),
                    "unique_users": stat.unique_users
                }
                for stat in daily_stats
            ],
            "prompt_types": [
                {"type": pt.prompt_type, "count": pt.count}
                for pt in prompt_types
            ],
            "model_usage": [
                {
                    "model": mu.model_used,
                    "count": mu.count,
                    "avg_execution_time": float(mu.avg_time or 0)
                }
                for mu in model_usage
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage analytics: {str(e)}")

@admin_router.get("/health")
async def admin_health():
    """Health check for admin endpoints"""
    return {
        "status": "healthy",
        "service": "admin",
        "timestamp": datetime.utcnow()
    }