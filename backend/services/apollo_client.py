"""
Apollo.io API client for prospect discovery
"""
import os
import httpx
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class ApolloClient:
    """Apollo.io API client for prospect search and discovery"""
    
    def __init__(self):
        self.api_key = os.getenv('APOLLO_API_KEY')
        self.base_url = 'https://api.apollo.io/v1'
        self.client = httpx.AsyncClient(timeout=30.0)
        
        if not self.api_key:
            logger.warning("Apollo API key not configured - some features may be limited")
    
    async def search_people(self, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Search for people using Apollo.io API"""
        if not self.api_key:
            logger.warning("Apollo API key not available")
            return None
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': self.api_key
            }
            
            # Build request payload
            payload = {
                'q_keywords': params.get('q_keywords', ''),
                'page': params.get('page', 1),
                'per_page': min(params.get('per_page', 50), 200)
            }
            
            # Add organization filters
            if params.get('organization_industry_tag_names'):
                payload['organization_industry_tag_names'] = params['organization_industry_tag_names']
            
            if params.get('organization_num_employees_ranges'):
                payload['organization_num_employees_ranges'] = params['organization_num_employees_ranges']
            
            # Add person filters
            if params.get('person_locations'):
                payload['person_locations'] = params['person_locations']
            
            if params.get('person_titles'):
                payload['person_titles'] = params['person_titles']
            
            logger.info(f"🔍 Apollo API request: {self.base_url}/mixed_people/search")
            
            response = await self.client.post(
                f"{self.base_url}/mixed_people/search",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Apollo search successful: {len(result.get('people', []))} results")
                return result
            else:
                logger.error(f"❌ Apollo API error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Apollo API request failed: {str(e)}")
            return None
    
    async def get_person(self, person_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed person information by ID"""
        if not self.api_key:
            return None
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'X-Api-Key': self.api_key
            }
            
            response = await self.client.get(
                f"{self.base_url}/people/{person_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Apollo person fetch error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Apollo person fetch failed: {str(e)}")
            return None
    
    async def enrich_person(self, email: str) -> Optional[Dict[str, Any]]:
        """Enrich person data by email"""
        if not self.api_key:
            return None
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'X-Api-Key': self.api_key
            }
            
            payload = {
                'email': email,
                'reveal_personal_emails': True
            }
            
            response = await self.client.post(
                f"{self.base_url}/people/match",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Apollo enrichment error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Apollo enrichment failed: {str(e)}")
            return None
    
    def is_available(self) -> bool:
        """Check if Apollo API is available"""
        return bool(self.api_key)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()