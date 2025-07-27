"""
Comprehensive Prospect Search Engine with Multi-Source Aggregation
CARD-007: Prospect Search Engine Backend Implementation
"""
import asyncio
import time
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging
import re
from collections import defaultdict

from models.search import (
    SearchRequest, SearchResponse, ProspectSearchResult, 
    SearchInsights, SearchAnalytics, SearchFilters, CompanySize
)
from .apollo_client import ApolloClient
from .redis_service import redis_client, cache_key
from database import get_database
import json
import hashlib

logger = logging.getLogger(__name__)

class ProspectSearchEngine:
    """Comprehensive search engine with multi-source aggregation and AI ranking"""
    
    def __init__(self):
        self.apollo_client = ApolloClient()
        self.data_sources = {
            'apollo': self.apollo_client,
            'database': 'internal_db',
            'enrichment': 'ai_enrichment'
        }
        
    async def search_prospects(self, request: SearchRequest, user_id: str) -> SearchResponse:
        """
        Main search method with multi-source aggregation and intelligent ranking
        """
        start_time = time.time()
        query_id = str(uuid.uuid4())
        
        logger.info(f"🔍 Starting prospect search - Query ID: {query_id}")
        logger.info(f"🔍 Search parameters: {request.dict()}")
        
        # Check cache first
        cache_key_str = self._generate_cache_key(request, user_id)
        if cached_result := await self._get_cached_result(cache_key_str):
            logger.info(f"✅ Cache hit for search query")
            return cached_result
        
        # Initialize results collection
        all_prospects = []
        search_insights = {
            'sources_used': [],
            'duplicates_removed': 0,
            'intent_signals': [],
            'execution_times': {}
        }
        
        # 1. Search Apollo.io (primary external source)
        apollo_prospects = await self._search_apollo(request, search_insights)
        all_prospects.extend(apollo_prospects)
        
        # 2. Search internal database
        db_prospects = await self._search_database(request, user_id, search_insights)
        all_prospects.extend(db_prospects)
        
        # 3. Apply deduplication if enabled
        if request.enable_deduplication:
            all_prospects, duplicates_count = await self._deduplicate_prospects(all_prospects)
            search_insights['duplicates_removed'] = duplicates_count
        
        # 4. Apply AI-powered ranking and scoring
        ranked_prospects = await self._rank_and_score_prospects(all_prospects, request)
        
        # 5. Apply filters and sorting
        filtered_prospects = await self._apply_filters_and_sorting(ranked_prospects, request)
        
        # 6. Apply pagination
        paginated_prospects, total_results = self._apply_pagination(filtered_prospects, request)
        
        # 7. Generate insights and analytics
        insights = await self._generate_search_insights(
            all_prospects, paginated_prospects, search_insights, start_time
        )
        
        # 8. Create search response
        response = SearchResponse(
            prospects=paginated_prospects,
            total_results=total_results,
            page=request.page,
            limit=request.limit,
            total_pages=(total_results + request.limit - 1) // request.limit,
            has_more=request.page * request.limit < total_results,
            insights=insights,
            query_id=query_id,
            execution_time_ms=int((time.time() - start_time) * 1000),
            cached=False
        )
        
        # 9. Cache the result
        await self._cache_result(cache_key_str, response)
        
        # 10. Log search analytics
        await self._log_search_analytics(request, response, user_id)
        
        logger.info(f"✅ Search completed - {total_results} results in {response.execution_time_ms}ms")
        return response
    
    async def _search_apollo(self, request: SearchRequest, insights: Dict) -> List[ProspectSearchResult]:
        """Search Apollo.io API with advanced parameters"""
        start_time = time.time()
        prospects = []
        
        try:
            logger.info("🔍 Searching Apollo.io...")
            
            # Build Apollo search parameters
            apollo_params = self._build_apollo_params(request)
            
            # Execute Apollo search
            apollo_results = await self.apollo_client.search_people(apollo_params)
            
            if apollo_results and apollo_results.get('people'):
                for person in apollo_results['people']:
                    prospect = self._convert_apollo_to_prospect(person)
                    prospects.append(prospect)
                
                insights['sources_used'].append('apollo')
                insights['execution_times']['apollo'] = int((time.time() - start_time) * 1000)
                logger.info(f"✅ Apollo search completed: {len(prospects)} prospects")
            
        except Exception as e:
            logger.error(f"❌ Apollo search failed: {str(e)}")
            # Continue with other sources even if Apollo fails
        
        return prospects
    
    async def _search_database(self, request: SearchRequest, user_id: str, insights: Dict) -> List[ProspectSearchResult]:
        """Search internal database with full-text search"""
        start_time = time.time()
        prospects = []
        
        try:
            logger.info("🔍 Searching internal database...")
            db = await get_database()
            
            # Build database query with filters
            query, params = self._build_database_query(request, user_id)
            
            # Execute database search
            db_results = await db.fetch_all(query, params)
            
            for row in db_results:
                prospect = self._convert_db_to_prospect(dict(row))
                prospects.append(prospect)
            
            insights['sources_used'].append('database')
            insights['execution_times']['database'] = int((time.time() - start_time) * 1000)
            logger.info(f"✅ Database search completed: {len(prospects)} prospects")
            
        except Exception as e:
            logger.error(f"❌ Database search failed: {str(e)}")
        
        return prospects
    
    async def _deduplicate_prospects(self, prospects: List[ProspectSearchResult]) -> Tuple[List[ProspectSearchResult], int]:
        """Advanced deduplication using email, name, and company matching"""
        if not prospects:
            return prospects, 0
        
        logger.info(f"🔍 Deduplicating {len(prospects)} prospects...")
        
        # Group prospects by potential duplicates
        prospect_groups = defaultdict(list)
        
        for prospect in prospects:
            # Create deduplication key based on email, name, and company
            dedup_key = self._generate_dedup_key(prospect)
            prospect_groups[dedup_key].append(prospect)
        
        # Merge duplicates and keep best version
        deduplicated = []
        duplicates_removed = 0
        
        for group in prospect_groups.values():
            if len(group) == 1:
                deduplicated.append(group[0])
            else:
                # Merge duplicates - keep the one with highest confidence
                best_prospect = max(group, key=lambda p: p.confidence_score)
                
                # Merge data from all duplicates
                merged_prospect = self._merge_duplicate_prospects(group, best_prospect)
                deduplicated.append(merged_prospect)
                duplicates_removed += len(group) - 1
        
        logger.info(f"✅ Deduplication completed: {duplicates_removed} duplicates removed")
        return deduplicated, duplicates_removed
    
    async def _rank_and_score_prospects(self, prospects: List[ProspectSearchResult], request: SearchRequest) -> List[ProspectSearchResult]:
        """AI-powered ranking and relevance scoring using Nexus.ai methodology"""
        if not prospects:
            return prospects
        
        logger.info(f"🔍 Ranking and scoring {len(prospects)} prospects...")
        
        # Nexus.ai scoring algorithm
        for prospect in prospects:
            # Base relevance score from keyword matching
            relevance_score = self._calculate_keyword_relevance(prospect, request.keywords)
            
            # Data quality score
            quality_score = self._calculate_data_quality_score(prospect)
            
            # Intent signal score
            intent_score = self._calculate_intent_signals(prospect)
            
            # Company fit score
            company_score = self._calculate_company_fit_score(prospect, request.filters)
            
            # Combined Nexus.ai confidence score
            prospect.confidence_score = (
                relevance_score * 0.3 +
                quality_score * 0.25 +
                intent_score * 0.25 +
                company_score * 0.2
            )
            
            prospect.relevance_score = relevance_score
            
            # Add intent signals
            prospect.intent_signals = self._extract_intent_signals(prospect)
        
        logger.info("✅ Prospect ranking and scoring completed")
        return prospects
    
    async def _apply_filters_and_sorting(self, prospects: List[ProspectSearchResult], request: SearchRequest) -> List[ProspectSearchResult]:
        """Apply advanced filters and sorting"""
        if not prospects:
            return prospects
        
        filtered = prospects
        
        # Apply filters if provided
        if request.filters:
            filtered = self._apply_search_filters(filtered, request.filters)
        
        # Apply sorting
        filtered = self._apply_sorting(filtered, request.order_by, request.sort_order)
        
        logger.info(f"✅ Filtering and sorting completed: {len(filtered)} prospects")
        return filtered
    
    def _apply_pagination(self, prospects: List[ProspectSearchResult], request: SearchRequest) -> Tuple[List[ProspectSearchResult], int]:
        """Apply pagination to results"""
        total_results = len(prospects)
        start_idx = (request.page - 1) * request.limit
        end_idx = start_idx + request.limit
        
        paginated = prospects[start_idx:end_idx]
        return paginated, total_results
    
    async def _generate_search_insights(self, all_prospects: List[ProspectSearchResult], 
                                      final_prospects: List[ProspectSearchResult], 
                                      search_data: Dict, start_time: float) -> SearchInsights:
        """Generate comprehensive search insights and analytics"""
        
        # Calculate metrics
        total_sources = len(search_data['sources_used'])
        avg_confidence = sum(p.confidence_score for p in final_prospects) / len(final_prospects) if final_prospects else 0
        execution_time = int((time.time() - start_time) * 1000)
        
        # Extract insights
        industries = defaultdict(int)
        locations = defaultdict(int)
        companies = defaultdict(int)
        intent_signals = set()
        
        for prospect in all_prospects:
            if prospect.industry:
                industries[prospect.industry] += 1
            if prospect.location:
                locations[prospect.location] += 1
            if prospect.company:
                companies[prospect.company] += 1
            if prospect.intent_signals:
                intent_signals.update(prospect.intent_signals)
        
        # Generate suggestions
        suggestions = self._generate_search_suggestions(all_prospects, final_prospects)
        
        return SearchInsights(
            total_sources_searched=total_sources,
            search_quality_score=min(avg_confidence * 1.2, 1.0),  # Boost quality score
            average_confidence=avg_confidence,
            duplicates_removed=search_data['duplicates_removed'],
            intent_signals_detected=list(intent_signals),
            top_industries=[{"name": k, "count": v} for k, v in sorted(industries.items(), key=lambda x: x[1], reverse=True)[:5]],
            top_locations=[{"name": k, "count": v} for k, v in sorted(locations.items(), key=lambda x: x[1], reverse=True)[:5]],
            top_companies=[{"name": k, "count": v} for k, v in sorted(companies.items(), key=lambda x: x[1], reverse=True)[:5]],
            search_suggestions=suggestions,
            execution_time_ms=execution_time
        )
    
    # Helper methods for data conversion and processing
    
    def _build_apollo_params(self, request: SearchRequest) -> Dict[str, Any]:
        """Build Apollo.io API parameters from search request"""
        params = {
            'q_keywords': request.keywords,
            'page': 1,
            'per_page': min(request.limit * 2, 200)  # Get more results for deduplication
        }
        
        if request.filters:
            if request.filters.industry:
                params['organization_industry_tag_names'] = request.filters.industry
            if request.filters.location:
                params['person_locations'] = request.filters.location
            if request.filters.job_titles:
                params['person_titles'] = request.filters.job_titles
            if request.filters.company_size:
                params['organization_num_employees_ranges'] = [cs.value for cs in request.filters.company_size]
        
        return params
    
    def _build_database_query(self, request: SearchRequest, user_id: str) -> Tuple[str, Dict]:
        """Build database query with full-text search and filters"""
        base_query = """
            SELECT *, 
                   ts_rank_cd(to_tsvector('english', name || ' ' || COALESCE(company, '') || ' ' || COALESCE(title, '') || ' ' || COALESCE(industry, '')), 
                             plainto_tsquery('english', :keywords)) as search_rank
            FROM prospects 
            WHERE (user_id = :user_id OR data_source = 'public')
        """
        
        params = {
            'user_id': user_id,
            'keywords': request.keywords
        }
        
        # Add keyword search
        if request.keywords:
            base_query += " AND (name ILIKE :keyword_pattern OR company ILIKE :keyword_pattern OR title ILIKE :keyword_pattern OR industry ILIKE :keyword_pattern)"
            params['keyword_pattern'] = f"%{request.keywords}%"
        
        # Add filters
        if request.filters:
            if request.filters.industry:
                base_query += " AND industry = ANY(:industries)"
                params['industries'] = request.filters.industry
                
            if request.filters.location:
                base_query += " AND location = ANY(:locations)"
                params['locations'] = request.filters.location
        
        base_query += " ORDER BY search_rank DESC, created_at DESC LIMIT 500"
        
        return base_query, params
    
    def _convert_apollo_to_prospect(self, apollo_person: Dict) -> ProspectSearchResult:
        """Convert Apollo.io person data to ProspectSearchResult"""
        organization = apollo_person.get('organization', {}) or {}
        
        return ProspectSearchResult(
            id=str(uuid.uuid4()),
            name=f"{apollo_person.get('first_name', '')} {apollo_person.get('last_name', '')}".strip(),
            first_name=apollo_person.get('first_name'),
            last_name=apollo_person.get('last_name'),
            email=apollo_person.get('email'),
            phone=apollo_person.get('phone'),
            company=organization.get('name', ''),
            title=apollo_person.get('title'),
            industry=organization.get('industry'),
            location=apollo_person.get('city'),
            linkedin_url=apollo_person.get('linkedin_url'),
            website_url=organization.get('website_url'),
            confidence_score=0.8,  # High confidence for Apollo data
            relevance_score=0.0,  # Will be calculated later
            data_source='apollo',
            data_sources=['apollo'],
            employee_count=organization.get('estimated_num_employees'),
            revenue=organization.get('estimated_annual_revenue'),
            funding_stage=organization.get('funding_stage'),
            technologies=organization.get('technologies', []),
            intent_signals=[],
            last_updated=datetime.utcnow().isoformat()
        )
    
    def _convert_db_to_prospect(self, db_row: Dict) -> ProspectSearchResult:
        """Convert database row to ProspectSearchResult"""
        return ProspectSearchResult(
            id=str(db_row.get('id', '')),
            name=db_row.get('name', ''),
            first_name=db_row.get('first_name'),
            last_name=db_row.get('last_name'),
            email=db_row.get('email'),
            phone=db_row.get('phone'),
            company=db_row.get('company', ''),
            title=db_row.get('title'),
            industry=db_row.get('industry'),
            location=db_row.get('location'),
            linkedin_url=db_row.get('linkedin_url'),
            website_url=db_row.get('website_url'),
            confidence_score=db_row.get('score', 50) / 100.0,
            relevance_score=db_row.get('search_rank', 0.0),
            data_source='database',
            data_sources=['database'],
            employee_count=None,
            revenue=None,
            funding_stage=None,
            technologies=[],
            intent_signals=[],
            last_updated=db_row.get('updated_at', '').isoformat() if db_row.get('updated_at') else None
        )
    
    def _generate_dedup_key(self, prospect: ProspectSearchResult) -> str:
        """Generate deduplication key for prospect"""
        # Use email as primary key if available
        if prospect.email:
            return f"email:{prospect.email.lower()}"
        
        # Fall back to name + company combination
        name_key = re.sub(r'[^a-zA-Z0-9]', '', (prospect.name or '').lower())
        company_key = re.sub(r'[^a-zA-Z0-9]', '', (prospect.company or '').lower())
        
        return f"name_company:{name_key}:{company_key}"
    
    def _merge_duplicate_prospects(self, duplicates: List[ProspectSearchResult], best: ProspectSearchResult) -> ProspectSearchResult:
        """Merge data from duplicate prospects into the best one"""
        # Combine data sources
        all_sources = set()
        for dup in duplicates:
            all_sources.update(dup.data_sources)
        
        best.data_sources = list(all_sources)
        
        # Take the best available data for each field
        for dup in duplicates:
            if not best.email and dup.email:
                best.email = dup.email
            if not best.phone and dup.phone:
                best.phone = dup.phone
            if not best.linkedin_url and dup.linkedin_url:
                best.linkedin_url = dup.linkedin_url
            if not best.website_url and dup.website_url:
                best.website_url = dup.website_url
        
        return best
    
    def _calculate_keyword_relevance(self, prospect: ProspectSearchResult, keywords: str) -> float:
        """Calculate keyword relevance score"""
        if not keywords:
            return 0.5
        
        keywords_lower = keywords.lower()
        text_fields = [
            prospect.name or '',
            prospect.company or '',
            prospect.title or '',
            prospect.industry or ''
        ]
        
        combined_text = ' '.join(text_fields).lower()
        
        # Count keyword matches
        matches = 0
        total_keywords = len(keywords.split())
        
        for keyword in keywords.split():
            if keyword.lower() in combined_text:
                matches += 1
        
        return min(matches / total_keywords if total_keywords > 0 else 0, 1.0)
    
    def _calculate_data_quality_score(self, prospect: ProspectSearchResult) -> float:
        """Calculate data quality score based on completeness"""
        fields = [
            prospect.name, prospect.email, prospect.company, 
            prospect.title, prospect.industry, prospect.location
        ]
        
        filled_fields = sum(1 for field in fields if field and field.strip())
        return filled_fields / len(fields)
    
    def _calculate_intent_signals(self, prospect: ProspectSearchResult) -> float:
        """Calculate intent signal score"""
        # This would integrate with real intent data sources
        # For now, return a base score
        return 0.6
    
    def _calculate_company_fit_score(self, prospect: ProspectSearchResult, filters: Optional[SearchFilters]) -> float:
        """Calculate company fit score based on filters"""
        if not filters:
            return 0.7
        
        score = 0.7  # Base score
        
        # Boost score if matches filter criteria
        if filters.industry and prospect.industry in filters.industry:
            score += 0.2
        
        if filters.location and prospect.location:
            for location in filters.location:
                if location.lower() in prospect.location.lower():
                    score += 0.1
                    break
        
        return min(score, 1.0)
    
    def _extract_intent_signals(self, prospect: ProspectSearchResult) -> List[str]:
        """Extract buying intent signals"""
        signals = []
        
        # Example intent signals based on title and company
        if prospect.title:
            title_lower = prospect.title.lower()
            if any(word in title_lower for word in ['vp', 'director', 'head', 'chief', 'ceo', 'cto']):
                signals.append('decision_maker')
            if any(word in title_lower for word in ['sales', 'marketing', 'growth']):
                signals.append('revenue_focused')
        
        return signals
    
    def _apply_search_filters(self, prospects: List[ProspectSearchResult], filters: SearchFilters) -> List[ProspectSearchResult]:
        """Apply search filters to prospect list"""
        filtered = prospects
        
        if filters.industry:
            filtered = [p for p in filtered if p.industry in filters.industry]
        
        if filters.location:
            filtered = [p for p in filtered if p.location and any(loc.lower() in p.location.lower() for loc in filters.location)]
        
        if filters.job_titles:
            filtered = [p for p in filtered if p.title and any(title.lower() in p.title.lower() for title in filters.job_titles)]
        
        return filtered
    
    def _apply_sorting(self, prospects: List[ProspectSearchResult], order_by: str, sort_order: str) -> List[ProspectSearchResult]:
        """Apply sorting to prospects"""
        reverse = sort_order.lower() == 'desc'
        
        if order_by == 'relevance':
            return sorted(prospects, key=lambda p: p.relevance_score, reverse=reverse)
        elif order_by == 'confidence':
            return sorted(prospects, key=lambda p: p.confidence_score, reverse=reverse)
        elif order_by == 'alphabetical':
            return sorted(prospects, key=lambda p: p.name or '', reverse=reverse)
        
        return prospects
    
    def _generate_search_suggestions(self, all_prospects: List[ProspectSearchResult], 
                                   final_prospects: List[ProspectSearchResult]) -> List[str]:
        """Generate search improvement suggestions"""
        suggestions = []
        
        if len(final_prospects) < 10:
            suggestions.append("Try broader keywords to find more prospects")
        
        if len(all_prospects) > len(final_prospects) * 2:
            suggestions.append("Add more specific filters to refine results")
        
        if not any(p.confidence_score > 0.8 for p in final_prospects):
            suggestions.append("Consider adjusting search criteria for higher quality results")
        
        return suggestions[:3]  # Limit to top 3 suggestions
    
    # Caching methods
    
    def _generate_cache_key(self, request: SearchRequest, user_id: str) -> str:
        """Generate cache key for search request"""
        request_hash = hashlib.md5(
            json.dumps(request.dict(), sort_keys=True).encode()
        ).hexdigest()
        return cache_key("prospect_search", f"{user_id}:{request_hash}")
    
    async def _get_cached_result(self, cache_key_str: str) -> Optional[SearchResponse]:
        """Get cached search result"""
        try:
            cached_data = await redis_client.get_json(cache_key_str)
            if cached_data:
                result = SearchResponse(**cached_data)
                result.cached = True
                return result
        except Exception as e:
            logger.warning(f"Cache get failed: {str(e)}")
        return None
    
    async def _cache_result(self, cache_key_str: str, response: SearchResponse):
        """Cache search result"""
        try:
            await redis_client.set_json(
                cache_key_str, 
                response.dict(), 
                expire=1800  # Cache for 30 minutes
            )
        except Exception as e:
            logger.warning(f"Cache set failed: {str(e)}")
    
    async def _log_search_analytics(self, request: SearchRequest, response: SearchResponse, user_id: str):
        """Log search analytics to database"""
        try:
            db = await get_database()
            
            analytics = SearchAnalytics(
                query_id=response.query_id,
                user_id=user_id,
                search_query=request.keywords,
                filters_applied=request.filters.dict() if request.filters else {},
                results_count=response.total_results,
                execution_time_ms=response.execution_time_ms,
                data_sources_used=response.insights.intent_signals_detected,
                cache_hit=response.cached,
                search_quality=response.insights.search_quality_score,
                created_at=datetime.utcnow().isoformat()
            )
            
            # Store in search analytics table
            await db.execute("""
                INSERT INTO search_analytics (
                    query_id, user_id, search_query, filters_applied, 
                    results_count, execution_time_ms, data_sources_used,
                    cache_hit, search_quality, created_at
                ) VALUES (
                    :query_id, :user_id, :search_query, :filters_applied,
                    :results_count, :execution_time_ms, :data_sources_used,
                    :cache_hit, :search_quality, :created_at
                )
            """, analytics.dict())
            
        except Exception as e:
            logger.error(f"Failed to log search analytics: {str(e)}")

# Global search engine instance
search_engine = ProspectSearchEngine()