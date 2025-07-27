"""
Startup script for FastAPI backend
"""
import uvicorn
import os
import sys

if __name__ == "__main__":
    # Set environment variables
    os.environ.setdefault("PYTHONPATH", os.path.dirname(os.path.abspath(__file__)))
    
    # Run FastAPI with uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["./"],
        log_level="info",
        access_log=True
    )