"""
Startup script for the FastAPI AI service
"""

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Run the FastAPI AI service
    uvicorn.run(
        "ai_service.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )