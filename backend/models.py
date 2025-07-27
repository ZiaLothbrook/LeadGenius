"""
SQLAlchemy models for the AI Lead Generation Platform
"""
from sqlalchemy import Column, String, Integer, Text, Boolean, TIMESTAMP, Numeric, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True)
    password = Column(String)
    email = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    profile_image_url = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    prospects = relationship("Prospect", back_populates="user")
    campaigns = relationship("Campaign", back_populates="user")
    messages = relationship("Message", back_populates="user")

class Prospect(Base):
    __tablename__ = "prospects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    company = Column(String)
    title = Column(String)
    industry = Column(String)
    location = Column(String)
    linkedin_url = Column(String)
    website_url = Column(String)
    score = Column(Integer, default=0)
    verified = Column(Boolean, default=False)
    data_source = Column(String)
    data_quality = Column(Integer, default=0)
    notes = Column(Text)
    tags = Column(ARRAY(String))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Add vector column for AI similarity search
    embedding = Column(String)  # Will store vector embeddings as text for now
    
    # Relationships
    user = relationship("User", back_populates="prospects")
    campaign_prospects = relationship("CampaignProspect", back_populates="prospect")

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # email, linkedin, phone, multi-channel
    status = Column(String, nullable=False, default="draft")  # draft, active, paused, completed
    subject = Column(String)
    message_template = Column(Text)
    goal = Column(String)
    tone = Column(String)
    total_prospects = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    response_count = Column(Integer, default=0)
    scheduled_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="campaigns")
    campaign_prospects = relationship("CampaignProspect", back_populates="campaign")
    messages = relationship("Message", back_populates="campaign")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"))
    prospect_id = Column(String, ForeignKey("prospects.id"))
    type = Column(String, nullable=False)  # email, linkedin, sms
    subject = Column(String)
    content = Column(Text, nullable=False)
    personalization_data = Column(JSON)
    ai_confidence = Column(Numeric(3, 2))
    status = Column(String, default="draft")  # draft, sent, delivered, opened, clicked, replied
    sent_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="messages")
    campaign = relationship("Campaign", back_populates="messages")

class CampaignProspect(Base):
    __tablename__ = "campaign_prospects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    prospect_id = Column(String, ForeignKey("prospects.id"), nullable=False)
    status = Column(String, default="pending")  # pending, sent, delivered, opened, clicked, replied
    message_sent_at = Column(TIMESTAMP)
    response_received_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    campaign = relationship("Campaign", back_populates="campaign_prospects")
    prospect = relationship("Prospect", back_populates="campaign_prospects")

class Analytics(Base):
    __tablename__ = "analytics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"))
    event_type = Column(String, nullable=False)  # sent, opened, clicked, replied
    event_data = Column(JSON)
    created_at = Column(TIMESTAMP, server_default=func.now())

class PromptLog(Base):
    __tablename__ = "prompt_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    prompt_type = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    input_data = Column(JSON)
    output_data = Column(JSON)
    execution_time = Column(Numeric(10, 3))
    token_usage = Column(JSON)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())