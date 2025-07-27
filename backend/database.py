"""
Database configuration and connection management
"""
import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from databases import Database
import asyncpg

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Ensure the URL is properly formatted for asyncpg
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create database instance
database = Database(DATABASE_URL)

# SQLAlchemy setup
engine = create_engine(DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData()

# Base class for models
Base = declarative_base()

async def get_database():
    """Dependency to get database connection"""
    return database

def get_db():
    """Dependency to get SQLAlchemy session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def execute_migration():
    """Execute database migrations and setup"""
    try:
        # Enable pgvector extension
        await database.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Create session table for authentication
        await database.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR PRIMARY KEY,
                sess JSONB NOT NULL,
                expire TIMESTAMP NOT NULL
            );
        """)
        
        # Create index on expire column
        await database.execute("""
            CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);
        """)
        
        print("✅ Database migrations completed successfully")
        
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        raise e