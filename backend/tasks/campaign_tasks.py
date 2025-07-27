"""
Celery tasks for campaign management
"""
from celery import shared_task
from services.openai_service import openai_service, MessageGenerationRequest
from services.postmark_service import postmark_service
from database import database
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def send_campaign_messages(self, campaign_id: str):
    """Background task to send messages for a campaign"""
    try:
        # Get campaign details
        campaign = database.fetch_one(
            "SELECT * FROM campaigns WHERE id = :id",
            {"id": campaign_id}
        )
        
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found")
            return {"error": "Campaign not found"}
        
        # Get campaign prospects
        prospects = database.fetch_all("""
            SELECT cp.*, p.name, p.email, p.company, p.title, p.industry
            FROM campaign_prospects cp
            JOIN prospects p ON cp.prospect_id = p.id
            WHERE cp.campaign_id = :campaign_id AND cp.status = 'pending'
        """, {"campaign_id": campaign_id})
        
        results = []
        sent_count = 0
        
        for prospect in prospects:
            try:
                # Generate personalized message
                message_request = MessageGenerationRequest(
                    prospect_name=prospect["name"],
                    prospect_company=prospect["company"],
                    prospect_title=prospect["title"] or "",
                    prospect_industry=prospect["industry"] or "",
                    campaign_goal=campaign["goal"],
                    message_type=campaign["type"],
                    tone=campaign["tone"]
                )
                
                message_result = openai_service.generate_personalized_message(message_request)
                
                # Send message based on campaign type
                if campaign["type"] == "email" and prospect["email"]:
                    # Send email via Postmark
                    email_result = postmark_service.send_email(
                        to=prospect["email"],
                        subject=message_result.subject or campaign["subject"],
                        content=message_result.message,
                        from_email="noreply@leadgen.ai"
                    )
                    
                    if email_result:
                        # Update prospect status
                        database.execute("""
                            UPDATE campaign_prospects 
                            SET status = 'sent', message_sent_at = NOW()
                            WHERE campaign_id = :campaign_id AND prospect_id = :prospect_id
                        """, {
                            "campaign_id": campaign_id,
                            "prospect_id": prospect["prospect_id"]
                        })
                        
                        # Create message record
                        database.execute("""
                            INSERT INTO messages (id, user_id, campaign_id, prospect_id, type, subject, content, status, sent_at, created_at, updated_at)
                            VALUES (gen_random_uuid(), :user_id, :campaign_id, :prospect_id, :type, :subject, :content, 'sent', NOW(), NOW(), NOW())
                        """, {
                            "user_id": campaign["user_id"],
                            "campaign_id": campaign_id,
                            "prospect_id": prospect["prospect_id"],
                            "type": "email",
                            "subject": message_result.subject,
                            "content": message_result.message
                        })
                        
                        sent_count += 1
                        results.append({
                            "prospect_id": prospect["prospect_id"],
                            "status": "sent",
                            "confidence_score": message_result.confidence_score
                        })
                    else:
                        results.append({
                            "prospect_id": prospect["prospect_id"],
                            "status": "failed",
                            "error": "Email delivery failed"
                        })
                
                elif campaign["type"] == "linkedin":
                    # For LinkedIn, we'll mark as ready for manual sending for now
                    database.execute("""
                        UPDATE campaign_prospects 
                        SET status = 'ready_linkedin'
                        WHERE campaign_id = :campaign_id AND prospect_id = :prospect_id
                    """, {
                        "campaign_id": campaign_id,
                        "prospect_id": prospect["prospect_id"]
                    })
                    
                    # Create message record
                    database.execute("""
                        INSERT INTO messages (id, user_id, campaign_id, prospect_id, type, content, status, created_at, updated_at)
                        VALUES (gen_random_uuid(), :user_id, :campaign_id, :prospect_id, :type, :content, 'draft', NOW(), NOW())
                    """, {
                        "user_id": campaign["user_id"],
                        "campaign_id": campaign_id,
                        "prospect_id": prospect["prospect_id"],
                        "type": "linkedin",
                        "content": message_result.message
                    })
                    
                    results.append({
                        "prospect_id": prospect["prospect_id"],
                        "status": "ready_linkedin",
                        "confidence_score": message_result.confidence_score
                    })
                
            except Exception as e:
                logger.error(f"Error processing prospect {prospect['prospect_id']}: {e}")
                results.append({
                    "prospect_id": prospect["prospect_id"],
                    "status": "error",
                    "error": str(e)
                })
        
        # Update campaign statistics
        database.execute("""
            UPDATE campaigns 
            SET sent_count = sent_count + :sent_count, updated_at = NOW()
            WHERE id = :campaign_id
        """, {
            "campaign_id": campaign_id,
            "sent_count": sent_count
        })
        
        logger.info(f"Campaign {campaign_id} processed: {sent_count} messages sent")
        return {
            "campaign_id": campaign_id,
            "total_processed": len(prospects),
            "sent_count": sent_count,
            "results": results
        }
        
    except Exception as exc:
        logger.error(f"Error processing campaign {campaign_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)

@shared_task
def update_campaign_stats(campaign_id: str):
    """Update campaign statistics"""
    try:
        # Get campaign prospect statuses
        stats = database.fetch_one("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN status IN ('opened', 'clicked', 'replied') THEN 1 END) as opened,
                COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied
            FROM campaign_prospects
            WHERE campaign_id = :campaign_id
        """, {"campaign_id": campaign_id})
        
        # Update campaign
        database.execute("""
            UPDATE campaigns 
            SET 
                sent_count = :sent_count,
                response_count = :response_count,
                updated_at = NOW()
            WHERE id = :campaign_id
        """, {
            "campaign_id": campaign_id,
            "sent_count": stats["sent"],
            "response_count": stats["replied"]
        })
        
        logger.info(f"Updated stats for campaign {campaign_id}")
        return stats
        
    except Exception as e:
        logger.error(f"Error updating campaign stats {campaign_id}: {e}")
        raise

@shared_task
def cleanup_completed_campaigns():
    """Background task to clean up completed campaigns"""
    try:
        # Mark campaigns as completed if all prospects have been processed
        result = database.execute("""
            UPDATE campaigns 
            SET status = 'completed', updated_at = NOW()
            WHERE status = 'active'
            AND id IN (
                SELECT c.id FROM campaigns c
                LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
                WHERE cp.status NOT IN ('pending', 'ready_linkedin')
                GROUP BY c.id
                HAVING COUNT(cp.id) = COUNT(CASE WHEN cp.status NOT IN ('pending', 'ready_linkedin') THEN 1 END)
            )
        """)
        
        logger.info(f"Marked {result} campaigns as completed")
        return {"completed_campaigns": result}
        
    except Exception as e:
        logger.error(f"Error cleaning up campaigns: {e}")
        raise