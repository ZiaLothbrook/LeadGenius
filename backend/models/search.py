"""
Search models for comprehensive prospect search engine
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class SearchOrderBy(str, Enum):
    RELEVANCE = "relevance"
    CONFIDENCE = "confidence"
    RECENT = "recent"
    COMPANY_SIZE = "company_size"
    ALPHABETICAL = "alphabetical"

class SearchSortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

class CompanySize(str, Enum):
    STARTUP = "1-10"
    SMALL = "11-50"
    MEDIUM = "51-200"
    LARGE = "201-1000"
    ENTERPRISE = "1001+"

class SearchFilters(BaseModel):
    industry: Optional[List[str]] = Field(None, description="Industry filters")
    company_size: Optional[List[CompanySize]] = Field(None, description="Company size filters")
    location: Optional[List[str]] = Field(None, description="Location filters")
    job_titles: Optional[List[str]] = Field(None, description="Job title filters")
    technologies: Optional[List[str]] = Field(None, description="Technology filters")
    funding_stage: Optional[List[str]] = Field(None, description="Funding stage filters")
    employee_count_min: Optional[int] = Field(None, description="Minimum employee count")
    employee_count_max: Optional[int] = Field(None, description="Maximum employee count")
    revenue_min: Optional[int] = Field(None, description="Minimum revenue")
    revenue_max: Optional[int] = Field(None, description="Maximum revenue")

class SearchRequest(BaseModel):
    keywords: str = Field(..., description="Search keywords")
    filters: Optional[SearchFilters] = Field(None, description="Search filters")
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=50, ge=1, le=500, description="Results per page")
    order_by: SearchOrderBy = Field(default=SearchOrderBy.RELEVANCE, description="Sort field")
    sort_order: SearchSortOrder = Field(default=SearchSortOrder.DESC, description="Sort order")
    include_ai_insights: bool = Field(default=True, description="Include AI insights")
    enable_deduplication: bool = Field(default=True, description="Enable duplicate detection")

class ProspectSearchResult(BaseModel):
    id: str = Field(..., description="Prospect ID")
    name: str = Field(..., description="Full name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    company: str = Field(..., description="Company name")
    title: Optional[str] = Field(None, description="Job title")
    industry: Optional[str] = Field(None, description="Industry")
    location: Optional[str] = Field(None, description="Location")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    website_url: Optional[str] = Field(None, description="Company website")
    confidence_score: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")
    relevance_score: float = Field(..., ge=0, le=1, description="Relevance score (0-1)")
    data_source: str = Field(..., description="Primary data source")
    data_sources: List[str] = Field(..., description="All data sources used")
    employee_count: Optional[int] = Field(None, description="Company employee count")
    revenue: Optional[int] = Field(None, description="Company revenue")
    funding_stage: Optional[str] = Field(None, description="Company funding stage")
    technologies: Optional[List[str]] = Field(None, description="Technologies used")
    intent_signals: Optional[List[str]] = Field(None, description="Buying intent signals")
    last_updated: Optional[str] = Field(None, description="Last update timestamp")

class SearchInsights(BaseModel):
    total_sources_searched: int = Field(..., description="Number of data sources searched")
    search_quality_score: float = Field(..., ge=0, le=1, description="Search quality score")
    average_confidence: float = Field(..., ge=0, le=1, description="Average confidence score")
    duplicates_removed: int = Field(..., description="Number of duplicates removed")
    intent_signals_detected: List[str] = Field(..., description="Intent signals detected")
    top_industries: List[Dict[str, Any]] = Field(..., description="Top industries found")
    top_locations: List[Dict[str, Any]] = Field(..., description="Top locations found")
    top_companies: List[Dict[str, Any]] = Field(..., description="Top companies found")
    search_suggestions: List[str] = Field(..., description="Search improvement suggestions")
    execution_time_ms: int = Field(..., description="Search execution time in milliseconds")

class SearchAnalytics(BaseModel):
    query_id: str = Field(..., description="Unique query ID")
    user_id: str = Field(..., description="User ID")
    search_query: str = Field(..., description="Search query")
    filters_applied: Dict[str, Any] = Field(..., description="Filters applied")
    results_count: int = Field(..., description="Number of results returned")
    execution_time_ms: int = Field(..., description="Execution time")
    data_sources_used: List[str] = Field(..., description="Data sources used")
    cache_hit: bool = Field(..., description="Whether cache was hit")
    search_quality: float = Field(..., ge=0, le=1, description="Search quality score")
    created_at: str = Field(..., description="Search timestamp")

class SearchResponse(BaseModel):
    prospects: List[ProspectSearchResult] = Field(..., description="Search results")
    total_results: int = Field(..., description="Total number of results")
    page: int = Field(..., description="Current page")
    limit: int = Field(..., description="Results per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_more: bool = Field(..., description="Whether more results are available")
    insights: SearchInsights = Field(..., description="Search insights and analytics")
    query_id: str = Field(..., description="Unique query ID for tracking")
    execution_time_ms: int = Field(..., description="Total execution time")
    cached: bool = Field(..., description="Whether result was cached")