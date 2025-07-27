"""
Celery tasks for prospect management
"""
from celery import shared_task
from services.openai_service import openai_service, ProspectEnrichmentRequest
from database import database
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def enrich_prospect_data(self, prospect_id: str):
    """Background task to enrich prospect data"""
    try:
        # Get prospect from database
        prospect = database.fetch_one(
            "SELECT * FROM prospects WHERE id = :id",
            {"id": prospect_id}
        )
        
        if not prospect:
            logger.error(f"Prospect {prospect_id} not found")
            return {"error": "Prospect not found"}
        
        # Create enrichment request
        enrichment_request = ProspectEnrichmentRequest(
            name=prospect["name"],
            company=prospect["company"],
            email=prospect["email"],
            linkedin_url=prospect["linkedin_url"]
        )
        
        # Enrich using AI
        enrichment_result = openai_service.enrich_prospect_data(enrichment_request)
        
        # Update prospect in database
        new_score = int(enrichment_result.confidence_score * 100)
        
        database.execute("""
            UPDATE prospects 
            SET score = :score, data_quality = :data_quality, updated_at = NOW()
            WHERE id = :id
        """, {
            "id": prospect_id,
            "score": new_score,
            "data_quality": int(enrichment_result.confidence_score * 100)
        })
        
        logger.info(f"Successfully enriched prospect {prospect_id}")
        return {
            "prospect_id": prospect_id,
            "enrichment_data": enrichment_result.enriched_data,
            "confidence_score": enrichment_result.confidence_score,
            "updated_score": new_score
        }
        
    except Exception as exc:
        logger.error(f"Error enriching prospect {prospect_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)

@shared_task(bind=True, max_retries=3)
def bulk_enrich_prospects(self, prospect_ids: list):
    """Background task to enrich multiple prospects"""
    results = []
    
    for prospect_id in prospect_ids:
        try:
            result = enrich_prospect_data.apply_async(args=[prospect_id])
            results.append({
                "prospect_id": prospect_id,
                "task_id": result.task_id,
                "status": "queued"
            })
        except Exception as e:
            logger.error(f"Error queuing enrichment for prospect {prospect_id}: {e}")
            results.append({
                "prospect_id": prospect_id,
                "status": "error",
                "error": str(e)
            })
    
    return results

@shared_task
def cleanup_stale_prospects():
    """Background task to clean up stale prospect data"""
    try:
        # Remove prospects with very low quality scores that are older than 30 days
        result = database.execute("""
            DELETE FROM prospects 
            WHERE data_quality < 20 
            AND created_at < NOW() - INTERVAL '30 days'
        """)
        
        logger.info(f"Cleaned up {result} stale prospects")
        return {"cleaned_prospects": result}
        
    except Exception as e:
        logger.error(f"Error cleaning up prospects: {e}")
        raise