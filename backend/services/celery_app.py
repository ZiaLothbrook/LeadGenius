"""
Celery configuration for background tasks
"""
import os
from celery import Celery
import logging

logger = logging.getLogger(__name__)

# Redis URL for Celery broker
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery instance
celery_app = Celery(
    "leadgen_platform",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "tasks.prospect_tasks",
        "tasks.campaign_tasks", 
        "tasks.email_tasks",
        "tasks.ai_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    result_expires=3600,  # 1 hour
)

# Task routing
celery_app.conf.task_routes = {
    "tasks.prospect_tasks.*": {"queue": "prospects"},
    "tasks.campaign_tasks.*": {"queue": "campaigns"},
    "tasks.email_tasks.*": {"queue": "emails"},
    "tasks.ai_tasks.*": {"queue": "ai"},
}

# Monitoring
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True

if __name__ == "__main__":
    celery_app.start()