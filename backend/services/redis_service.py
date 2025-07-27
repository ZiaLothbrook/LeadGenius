"""
Redis service for caching and session management
"""
import os
import json
import redis.asyncio as redis
from typing import Optional, Any, Dict
import logging

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis = redis.from_url(redis_url, decode_responses=True)
        
    async def ping(self):
        """Test Redis connection"""
        return await self.redis.ping()
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis"""
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """Set value in Redis with optional expiration"""
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            await self.redis.set(key, value, ex=expire)
            return True
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from Redis"""
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return False
    
    async def get_json(self, key: str) -> Optional[Dict]:
        """Get JSON value from Redis"""
        try:
            value = await self.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis GET_JSON error for key {key}: {e}")
            return None
    
    async def set_json(self, key: str, value: Dict, expire: Optional[int] = None) -> bool:
        """Set JSON value in Redis"""
        return await self.set(key, value, expire)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        try:
            return bool(await self.redis.exists(key))
        except Exception as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a counter in Redis"""
        try:
            return await self.redis.incrby(key, amount)
        except Exception as e:
            logger.error(f"Redis INCREMENT error for key {key}: {e}")
            return None
    
    async def set_hash(self, key: str, mapping: Dict[str, Any]) -> bool:
        """Set hash in Redis"""
        try:
            await self.redis.hset(key, mapping=mapping)
            return True
        except Exception as e:
            logger.error(f"Redis HSET error for key {key}: {e}")
            return False
    
    async def get_hash(self, key: str) -> Optional[Dict]:
        """Get hash from Redis"""
        try:
            return await self.redis.hgetall(key)
        except Exception as e:
            logger.error(f"Redis HGETALL error for key {key}: {e}")
            return None
    
    async def add_to_set(self, key: str, *values) -> bool:
        """Add values to a set in Redis"""
        try:
            await self.redis.sadd(key, *values)
            return True
        except Exception as e:
            logger.error(f"Redis SADD error for key {key}: {e}")
            return False
    
    async def get_set(self, key: str) -> Optional[set]:
        """Get set from Redis"""
        try:
            return await self.redis.smembers(key)
        except Exception as e:
            logger.error(f"Redis SMEMBERS error for key {key}: {e}")
            return None

# Global Redis client instance
redis_client = RedisService()

# Cache decorators and utilities
def cache_key(prefix: str, *args) -> str:
    """Generate cache key"""
    return f"{prefix}:" + ":".join(str(arg) for arg in args)

async def cached_request(key: str, expire: int = 3600):
    """Decorator for caching API requests"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Try to get from cache first
            cached_result = await redis_client.get_json(key)
            if cached_result:
                logger.info(f"Cache hit for key: {key}")
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await redis_client.set_json(key, result, expire)
            logger.info(f"Cache miss, stored result for key: {key}")
            return result
        return wrapper
    return decorator