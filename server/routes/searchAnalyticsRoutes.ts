import { Router } from "express";
import { z } from "zod";
import { searchAnalyticsService } from "../services/searchAnalyticsService";
import { cacheApiResponse } from "../middleware/cacheMiddleware";
import {
  trackSearchQuerySchema,
  trackSearchResultSchema,
  recordResultClickSchema,
  searchAnalyticsFiltersSchema,
} from "../services/searchAnalyticsService";

const router = Router();

// Validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors,
        });
      }
      next(error);
    }
  };
};

// Search Query Tracking
router.post("/track-query", validateRequest(trackSearchQuerySchema), async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    const query = await searchAnalyticsService.trackSearchQuery(userId, data);

    res.json({
      success: true,
      data: query,
      message: "Search query tracked successfully",
    });
  } catch (error: any) {
    console.error("Error tracking search query:", error);
    res.status(500).json({
      error: "Failed to track search query",
      details: error.message,
    });
  }
});

// Search Result Tracking (batch endpoint)
router.post("/track-results", async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { results } = req.body;

    if (!Array.isArray(results)) {
      return res.status(400).json({
        error: "Results must be an array",
      });
    }

    // Validate each result
    for (const result of results) {
      trackSearchResultSchema.parse(result);
    }

    const trackedResults = await searchAnalyticsService.trackSearchResults(userId, results);

    res.json({
      success: true,
      data: trackedResults,
      message: `${trackedResults.length} search results tracked successfully`,
    });
  } catch (error: any) {
    console.error("Error tracking search results:", error);
    res.status(500).json({
      error: "Failed to track search results",
      details: error.message,
    });
  }
});

// Record Result Click
router.post("/record-click", validateRequest(recordResultClickSchema), async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    const result = await searchAnalyticsService.recordResultClick(userId, data);

    if (!result) {
      return res.status(404).json({
        error: "Search result not found",
      });
    }

    res.json({
      success: true,
      data: result,
      message: "Result click recorded successfully",
    });
  } catch (error: any) {
    console.error("Error recording result click:", error);
    res.status(500).json({
      error: "Failed to record result click",
      details: error.message,
    });
  }
});

// Get Search Performance Metrics
router.get(
  "/performance-metrics",
  cacheApiResponse(300), // 5 minutes cache
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const filters = req.query;

      // Validate filters
      const validatedFilters = searchAnalyticsFiltersSchema.parse(filters);

      const metrics = await searchAnalyticsService.getSearchPerformanceMetrics(userId, validatedFilters);

      res.json({
        success: true,
        data: {
          metrics,
          filters: validatedFilters,
          timestamp: new Date().toISOString(),
        },
        message: "Performance metrics retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting performance metrics:", error);
      res.status(500).json({
        error: "Failed to get performance metrics",
        details: error.message,
      });
    }
  }
);

// Get Search Quality Analysis
router.get(
  "/quality-analysis",
  cacheApiResponse(300), // 5 minutes cache
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const filters = req.query;

      const validatedFilters = searchAnalyticsFiltersSchema.parse(filters);

      const analysis = await searchAnalyticsService.getSearchQualityAnalysis(userId, validatedFilters);

      res.json({
        success: true,
        data: {
          analysis,
          filters: validatedFilters,
          timestamp: new Date().toISOString(),
        },
        message: "Quality analysis retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting quality analysis:", error);
      res.status(500).json({
        error: "Failed to get quality analysis",
        details: error.message,
      });
    }
  }
);

// Get Search Behavior Analysis
router.get(
  "/behavior-analysis",
  cacheApiResponse(300), // 5 minutes cache
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const filters = req.query;

      const validatedFilters = searchAnalyticsFiltersSchema.parse(filters);

      const analysis = await searchAnalyticsService.getSearchBehaviorAnalysis(userId, validatedFilters);

      res.json({
        success: true,
        data: {
          analysis,
          filters: validatedFilters,
          timestamp: new Date().toISOString(),
        },
        message: "Behavior analysis retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting behavior analysis:", error);
      res.status(500).json({
        error: "Failed to get behavior analysis",
        details: error.message,
      });
    }
  }
);

// Get Search Optimization Recommendations
router.get("/optimizations", async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit || "10", 10);

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        error: "Limit must be between 1 and 50",
      });
    }

    const optimizations = await searchAnalyticsService.getOptimizationRecommendations(userId, limit);

    res.json({
      success: true,
      data: {
        optimizations,
        count: optimizations.length,
        timestamp: new Date().toISOString(),
      },
      message: "Optimization recommendations retrieved successfully",
    });
  } catch (error: any) {
    console.error("Error getting optimization recommendations:", error);
    res.status(500).json({
      error: "Failed to get optimization recommendations",
      details: error.message,
    });
  }
});

// Apply Search Optimization
router.post("/optimizations/:id/apply", async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const optimizationId = req.params.id;
    const { feedback } = req.body;

    const optimization = await searchAnalyticsService.applyOptimization(
      userId,
      optimizationId,
      feedback
    );

    if (!optimization) {
      return res.status(404).json({
        error: "Optimization not found",
      });
    }

    res.json({
      success: true,
      data: optimization,
      message: "Optimization applied successfully",
    });
  } catch (error: any) {
    console.error("Error applying optimization:", error);
    res.status(500).json({
      error: "Failed to apply optimization",
      details: error.message,
    });
  }
});

// Get Search Insights
router.get("/insights", async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit || "20", 10);

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "Limit must be between 1 and 100",
      });
    }

    const insights = await searchAnalyticsService.getSearchInsights(userId, limit);

    res.json({
      success: true,
      data: {
        insights,
        count: insights.length,
        timestamp: new Date().toISOString(),
      },
      message: "Search insights retrieved successfully",
    });
  } catch (error: any) {
    console.error("Error getting search insights:", error);
    res.status(500).json({
      error: "Failed to get search insights",
      details: error.message,
    });
  }
});

// Dismiss Search Insight
router.post("/insights/:id/dismiss", async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const insightId = req.params.id;

    const insight = await searchAnalyticsService.dismissInsight(userId, insightId);

    if (!insight) {
      return res.status(404).json({
        error: "Insight not found",
      });
    }

    res.json({
      success: true,
      data: insight,
      message: "Insight dismissed successfully",
    });
  } catch (error: any) {
    console.error("Error dismissing insight:", error);
    res.status(500).json({
      error: "Failed to dismiss insight",
      details: error.message,
    });
  }
});

// Get Combined Analytics Dashboard Data
router.get(
  "/dashboard",
  cacheApiResponse(180), // 3 minutes cache
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const filters = req.query;

      const validatedFilters = searchAnalyticsFiltersSchema.parse(filters);

      // Get all analytics data in parallel
      const [
        performanceMetrics,
        qualityAnalysis,
        behaviorAnalysis,
        optimizations,
        insights,
      ] = await Promise.all([
        searchAnalyticsService.getSearchPerformanceMetrics(userId, validatedFilters),
        searchAnalyticsService.getSearchQualityAnalysis(userId, validatedFilters),
        searchAnalyticsService.getSearchBehaviorAnalysis(userId, validatedFilters),
        searchAnalyticsService.getOptimizationRecommendations(userId, 5),
        searchAnalyticsService.getSearchInsights(userId, 10),
      ]);

      const dashboardData = {
        performance: performanceMetrics,
        quality: qualityAnalysis,
        behavior: behaviorAnalysis,
        optimizations: {
          recommendations: optimizations,
          count: optimizations.length,
        },
        insights: {
          items: insights,
          count: insights.length,
        },
        filters: validatedFilters,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: dashboardData,
        message: "Analytics dashboard data retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting dashboard data:", error);
      res.status(500).json({
        error: "Failed to get dashboard data",
        details: error.message,
      });
    }
  }
);

// Health check endpoint
router.get("/health", (req: any, res: any) => {
  res.json({
    success: true,
    service: "Search Analytics",
    status: "operational",
    timestamp: new Date().toISOString(),
    features: {
      queryTracking: true,
      resultAnalysis: true,
      behaviorAnalysis: true,
      optimizationRecommendations: true,
      searchInsights: true,
      performanceMetrics: true,
      qualityAnalysis: true,
    },
  });
});

export default router;