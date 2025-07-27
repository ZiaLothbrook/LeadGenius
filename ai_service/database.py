"""
Database configuration and models for AI service
"""

import os
from datetime import datetime
from typing import Dict, Any, AsyncGenerator
from sqlalchemy import create_engine, Column, String, DateTime, Integer, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Create engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

class PromptLogTable(Base):
    """Table for storing all LLM prompt interactions"""
    
    __tablename__ = "prompt_logs"
    
    id = Column(String, primary_key=True, index=True)
    prompt_type = Column(String, nullable=False, index=True)
    model_used = Column(String, nullable=False, index=True)
    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=False)
    user_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    execution_time_ms = Column(Integer, nullable=True)
    token_usage = Column(JSON, nullable=True)
    metadata = Column(JSON, nullable=True)

async def init_db():
    """Initialize database tables"""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Failed to create database tables: {str(e)}")
        raise

def get_db() -> Session:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()