"""
Redis service for caching and session management
"""
import json
import redis.asyncio as redis
import os
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

class RedisClient:
    """Async Redis client for caching operations"""
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.client = None
        self.connected = False
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self.client = redis.from_url(
                self.redis_url,
                encoding='utf8',
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            await self.client.ping()
            self.connected = True
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {str(e)} - continuing without cache")
            self.connected = False
    
    async def get_json(self, key: str) -> Optional[Any]:
        """Get JSON data from Redis"""
        if not self.connected:
            return None
        
        try:
            data = await self.client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Redis get failed: {str(e)}")
            return None
    
    async def set_json(self, key: str, data: Any, expire: Optional[int] = None):
        """Set JSON data in Redis with optional expiration"""
        if not self.connected:
            return
        
        try:
            json_data = json.dumps(data)
            await self.client.set(key, json_data, ex=expire)
        except Exception as e:
            logger.warning(f"Redis set failed: {str(e)}")
    
    async def delete(self, key: str):
        """Delete key from Redis"""
        if not self.connected:
            return
        
        try:
            await self.client.delete(key)
        except Exception as e:
            logger.warning(f"Redis delete failed: {str(e)}")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        if not self.connected:
            return False
        
        try:
            return bool(await self.client.exists(key))
        except Exception as e:
            logger.warning(f"Redis exists check failed: {str(e)}")
            return False

def cache_key(prefix: str, identifier: str) -> str:
    """Generate cache key with prefix"""
    return f"nexus:{prefix}:{identifier}"

# Global Redis client instance
redis_client = RedisClient()