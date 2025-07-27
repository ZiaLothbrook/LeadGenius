"""
Postmark email service integration
"""
import os
from postmark import PMMail
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class PostmarkService:
    def __init__(self):
        self.api_key = os.getenv("POSTMARK_API_KEY")
        if not self.api_key:
            logger.warning("POSTMARK_API_KEY not found - email functionality disabled")
    
    def send_email(
        self,
        to: str,
        subject: str,
        content: str,
        from_email: str = "noreply@leadgen.ai",
        from_name: str = "AI Lead Generation Platform"
    ) -> bool:
        """Send email via Postmark"""
        if not self.api_key:
            logger.error("Postmark API key not configured")
            return False
        
        try:
            message = PMMail(
                api_key=self.api_key,
                subject=subject,
                sender=f"{from_name} <{from_email}>",
                to=to,
                html_body=content,
                text_body=self._html_to_text(content)
            )
            
            result = message.send()
            
            if result.get('ErrorCode') == 0:
                logger.info(f"Email sent successfully to {to}")
                return True
            else:
                logger.error(f"Email failed to {to}: {result.get('Message')}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email to {to}: {e}")
            return False
    
    def send_bulk_emails(self, emails: list) -> dict:
        """Send multiple emails in batch"""
        if not self.api_key:
            logger.error("Postmark API key not configured")
            return {"success": 0, "failed": len(emails)}
        
        success_count = 0
        failed_count = 0
        
        for email_data in emails:
            success = self.send_email(
                to=email_data["to"],
                subject=email_data["subject"],
                content=email_data["content"],
                from_email=email_data.get("from_email", "noreply@leadgen.ai"),
                from_name=email_data.get("from_name", "AI Lead Generation Platform")
            )
            
            if success:
                success_count += 1
            else:
                failed_count += 1
        
        return {
            "success": success_count,
            "failed": failed_count,
            "total": len(emails)
        }
    
    def _html_to_text(self, html_content: str) -> str:
        """Convert HTML content to plain text"""
        # Simple HTML to text conversion
        import re
        
        # Remove HTML tags
        text = re.sub('<[^<]+?>', '', html_content)
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text

# Global Postmark service instance
postmark_service = PostmarkService()