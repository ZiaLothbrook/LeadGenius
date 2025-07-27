"""
Prompt Logger for tracking all LLM interactions
"""

import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from ..database import PromptLogTable
from ..models import PromptLog

logger = logging.getLogger(__name__)

class PromptLogger:
    """Service for logging all prompt interactions with LLMs"""
    
    async def log_prompt(
        self,
        db: Session,
        prompt_type: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        model_used: str,
        user_id: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        token_usage: Optional[Dict[str, int]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log a prompt interaction to the database"""
        
        try:
            # Create prompt log entry
            log_entry = PromptLogTable(
                id=str(uuid.uuid4()),
                prompt_type=prompt_type,
                model_used=model_used,
                input_data=input_data,
                output_data=output_data,
                user_id=user_id,
                execution_time_ms=execution_time_ms,
                token_usage=token_usage or {},
                metadata=metadata or {},
                created_at=datetime.utcnow()
            )
            
            # Save to database
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            
            logger.info(f"📝 Logged prompt interaction: {prompt_type} - {log_entry.id}")
            return str(log_entry.id)
            
        except Exception as e:
            logger.error(f"❌ Failed to log prompt: {str(e)}")
            db.rollback()
            raise Exception(f"Failed to log prompt: {str(e)}")
    
    async def get_prompt_logs(
        self,
        db: Session,
        limit: int = 100,
        offset: int = 0,
        prompt_type: Optional[str] = None,
        user_id: Optional[str] = None,
        model_used: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[PromptLog]:
        """Retrieve prompt logs with filtering"""
        
        try:
            query = db.query(PromptLogTable)
            
            # Apply filters
            if prompt_type:
                query = query.filter(PromptLogTable.prompt_type == prompt_type)
            if user_id:
                query = query.filter(PromptLogTable.user_id == user_id)
            if model_used:
                query = query.filter(PromptLogTable.model_used == model_used)
            if start_date:
                query = query.filter(PromptLogTable.created_at >= start_date)
            if end_date:
                query = query.filter(PromptLogTable.created_at <= end_date)
            
            # Order by newest first and apply pagination
            logs = query.order_by(PromptLogTable.created_at.desc()).offset(offset).limit(limit).all()
            
            # Convert to Pydantic models
            return [
                PromptLog(
                    id=str(log.id),
                    prompt_type=str(log.prompt_type),
                    model_used=str(log.model_used),
                    input_data=dict(log.input_data) if log.input_data else {},
                    output_data=dict(log.output_data) if log.output_data else {},
                    user_id=str(log.user_id) if log.user_id else None,
                    created_at=log.created_at,
                    execution_time_ms=int(log.execution_time_ms) if log.execution_time_ms else None,
                    token_usage=dict(log.token_usage) if log.token_usage else None,
                    metadata=dict(log.metadata) if log.metadata else None
                )
                for log in logs
            ]
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve prompt logs: {str(e)}")
            raise Exception(f"Failed to retrieve prompt logs: {str(e)}")
    
    async def get_dashboard_stats(self, db: Session) -> Dict[str, Any]:
        """Get dashboard statistics for admin panel"""
        
        try:
            from sqlalchemy import func, text
            
            # Total prompts
            total_prompts = db.query(func.count(PromptLogTable.id)).scalar()
            
            # Prompts today
            today = datetime.utcnow().date()
            prompts_today = db.query(func.count(PromptLogTable.id)).filter(
                func.date(PromptLogTable.created_at) == today
            ).scalar()
            
            # Average execution time
            avg_execution = db.query(func.avg(PromptLogTable.execution_time_ms)).scalar() or 0
            
            # Top models
            top_models = db.query(
                PromptLogTable.model_used,
                func.count(PromptLogTable.id).label('count')
            ).group_by(PromptLogTable.model_used).order_by(text('count DESC')).limit(5).all()
            
            # Error rate (approximate based on metadata)
            error_logs = db.query(func.count(PromptLogTable.id)).filter(
                PromptLogTable.metadata.contains({'error': True})
            ).scalar() or 0
            error_rate = error_logs / total_prompts if total_prompts > 0 else 0
            
            # Total tokens (approximate)
            total_tokens = 0
            token_query = db.query(PromptLogTable.token_usage).filter(
                PromptLogTable.token_usage.isnot(None)
            ).all()
            
            for row in token_query:
                if row.token_usage:
                    total_tokens += row.token_usage.get('prompt_tokens', 0) + row.token_usage.get('completion_tokens', 0)
            
            return {
                'total_prompts': total_prompts or 0,
                'prompts_today': prompts_today or 0,
                'average_execution_time': float(avg_execution),
                'top_models': [{'model': model, 'count': count} for model, count in top_models],
                'error_rate': float(error_rate),
                'total_tokens_used': total_tokens
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get dashboard stats: {str(e)}")
            return {
                'total_prompts': 0,
                'prompts_today': 0,
                'average_execution_time': 0.0,
                'top_models': [],
                'error_rate': 0.0,
                'total_tokens_used': 0
            }