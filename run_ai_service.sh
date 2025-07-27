#!/bin/bash

# Start script for Python FastAPI AI service
echo "🐍 Starting Python FastAPI AI Service..."

# Install Python dependencies if not already installed
if [ ! -d ".pythonlibs" ]; then
    echo "📦 Installing Python dependencies..."
    uv sync
fi

# Start the FastAPI service
python start_ai_service.py &

# Store the PID for later cleanup
echo $! > ai_service.pid

echo "✅ Python AI Service started on port 8001"
echo "🔧 PID: $!"

# Wait for the service to start
sleep 2

# Check if the service is running
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ Python AI Service is healthy and ready"
else
    echo "❌ Python AI Service failed to start or is not responding"
fi