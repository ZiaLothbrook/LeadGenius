import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  password: varchar("password"),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Postmark server configuration
  postmarkServerId: varchar("postmark_server_id"),
  postmarkServerToken: varchar("postmark_server_token"),
  postmarkServerName: varchar("postmark_server_name"),
  postmarkFromEmail: varchar("postmark_from_email"),
  postmarkFromName: varchar("postmark_from_name"),
  postmarkServerCreatedAt: timestamp("postmark_server_created_at"),
  // API Keys for data source integration
  apolloApiKey: varchar("apollo_api_key"),
  zoomInfoApiKey: varchar("zoominfo_api_key"),
  hunterApiKey: varchar("hunter_api_key"),
  apiKeysUpdatedAt: timestamp("api_keys_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const prospects: typeof pgTable = pgTable("prospects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  title: varchar("title"),
  industry: varchar("industry"),
  location: varchar("location"),
  linkedinUrl: varchar("linkedin_url"),
  websiteUrl: varchar("website_url"),
  
  // Enhanced multi-source data integration
  dataSources: text("data_sources").array().default(sql`ARRAY[]::text[]`), // apollo, zoominfo, hunter, clearbit, linkedin
  dataSource: varchar("data_source"), // Primary source (for backward compatibility)
  dataQuality: integer("data_quality").default(0), // Overall quality score 0-100
  dataQualityBreakdown: jsonb("data_quality_breakdown"), // {apollo: 95, zoominfo: 87, hunter: 92}
  lastEnriched: timestamp("last_enriched"),
  isVerified: boolean("is_verified").default(false),
  
  // Company enrichment data
  companySize: varchar("company_size"),
  companyRevenue: varchar("company_revenue"),
  companyFunding: varchar("company_funding"),
  companyTechnologies: text("company_technologies").array().default(sql`ARRAY[]::text[]`),
  companyEmployees: integer("company_employees"),
  companyType: varchar("company_type"), // startup, enterprise, sme
  
  // Contact enrichment data
  contactMethods: text("contact_methods").array().default(sql`ARRAY[]::text[]`), // email, phone, linkedin, twitter
  socialProfiles: jsonb("social_profiles"), // {twitter: url, github: url, etc}
  emailStatus: varchar("email_status"), // valid, invalid, risky, unknown
  phoneStatus: varchar("phone_status"), // valid, invalid, mobile, landline
  
  // AI scoring and insights
  aiScore: integer("ai_score"), // AI-generated lead score 0-100
  intentSignals: text("intent_signals").array().default(sql`ARRAY[]::text[]`),
  priorityLevel: varchar("priority_level").default("medium"), // high, medium, low
  
  // Deduplication and data management
  deduplicationHash: varchar("deduplication_hash"), // Hash for detecting duplicates
  masterRecord: boolean("master_record").default(true), // True for primary record in duplicate groups
  duplicateOf: varchar("duplicate_of").references(() => prospects.id), // Points to master record
  mergedRecords: text("merged_records").array().default(sql`ARRAY[]::text[]`), // IDs of records merged into this one
  
  // Source attribution and tracking
  sourceAttribution: jsonb("source_attribution"), // Detailed attribution per field
  lastUpdatedBy: varchar("last_updated_by"), // Which source last updated
  
  // Legacy fields
  score: integer("score").default(0),
  verified: boolean("verified").default(false),
  notes: text("notes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // email, linkedin, phone, multi-channel
  status: varchar("status").notNull().default("draft"), // draft, active, paused, completed
  subject: varchar("subject"),
  messageTemplate: text("message_template"),
  goal: varchar("goal"),
  tone: varchar("tone"),
  totalProspects: integer("total_prospects").default(0),
  sent: integer("sent").default(0),
  delivered: integer("delivered").default(0),
  opened: integer("opened").default(0),
  clicked: integer("clicked").default(0),
  replied: integer("replied").default(0),
  converted: integer("converted").default(0),
  scheduled: timestamp("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const campaignProspects = pgTable("campaign_prospects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id),
  prospectId: varchar("prospect_id").notNull().references(() => prospects.id),
  status: varchar("status").notNull().default("pending"), // pending, sent, delivered, opened, clicked, replied, converted
  personalizedMessage: text("personalized_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages: typeof pgTable = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  prospectId: varchar("prospect_id").notNull().references(() => prospects.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  type: varchar("type").notNull(), // email, linkedin, phone_script
  subject: varchar("subject"),
  content: text("content").notNull(),
  tone: varchar("tone"),
  aiGenerated: boolean("ai_generated").default(false),
  variant: varchar("variant"), // A, B, C for A/B testing
  confidenceScore: integer("confidence_score"),
  
  // Enhanced CARD-026 fields for comprehensive AI message generation
  personalizationScore: integer("personalization_score").default(0), // 0-100
  personalizationLevel: varchar("personalization_level").default("basic"), // basic, advanced, hyper-personalized
  personalizationPoints: text("personalization_points").array().default(sql`ARRAY[]::text[]`),
  contextDataUsed: jsonb("context_data_used"), // What data points were used
  qualityScore: integer("quality_score").default(0), // Overall message quality 0-100
  
  // Advanced AI metadata
  promptUsed: text("prompt_used"),
  modelUsed: varchar("model_used"),
  generationTime: integer("generation_time"), // milliseconds
  aiConfidence: integer("ai_confidence").default(0), // 0-100
  
  // Message analysis metrics
  readingTime: integer("reading_time"), // seconds
  wordCount: integer("word_count"),
  sentimentScore: decimal("sentiment_score", { precision: 5, scale: 2 }), // -1.0 to 1.0
  ctaStrength: integer("cta_strength").default(0), // 0-10
  complianceScore: integer("compliance_score").default(100), // 0-100
  
  // Enhanced A/B testing and variants
  parentMessageId: varchar("parent_message_id").references(() => messages.id),
  variantType: varchar("variant_type"), // subject, tone, length, cta, approach
  variantDescription: varchar("variant_description"),
  testGroup: varchar("test_group"), // A, B, C, etc.
  testHypothesis: text("test_hypothesis"),
  
  // Quality assurance system
  qaStatus: varchar("qa_status").default("pending"), // pending, approved, rejected, needs_review
  qaScore: integer("qa_score"), // 0-100
  qaFeedback: text("qa_feedback"),
  qaReviewerId: varchar("qa_reviewer_id").references(() => users.id),
  qaReviewedAt: timestamp("qa_reviewed_at"),
  
  // Performance tracking
  openRate: decimal("open_rate", { precision: 5, scale: 2 }),
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }),
  
  status: varchar("status").default("draft"), // draft, sent, delivered, opened, replied
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  date: timestamp("date").notNull(),
  metric: varchar("metric").notNull(), // sent, delivered, opened, clicked, replied, converted
  value: integer("value").notNull(),
  channel: varchar("channel"), // email, linkedin, phone, multi-channel
  createdAt: timestamp("created_at").defaultNow(),
});

// Search Analytics tables for CARD-025
export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  filters: jsonb("filters"), // SearchFilters object
  executionTime: integer("execution_time"), // milliseconds
  resultsCount: integer("results_count").default(0),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // 0-100
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }), // 0-100
  clickThroughRate: decimal("click_through_rate", { precision: 5, scale: 4 }), // 0-1
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }), // 0-1
  searchSource: varchar("search_source").default("web"), // web, api, mobile
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  refinements: integer("refinements").default(0), // Number of times user refined search
  timeToFirstClick: integer("time_to_first_click"), // milliseconds
  totalTimeSpent: integer("total_time_spent"), // milliseconds
  searchIntent: varchar("search_intent"), // discovery, qualification, research
  satisfaction: integer("satisfaction"), // 1-5 rating if provided
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchResults = pgTable("search_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id").notNull().references(() => searchQueries.id),
  prospectId: varchar("prospect_id").references(() => prospects.id),
  position: integer("position").notNull(), // 1-based position in results
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 2 }), // 0-100
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // 0-100
  dataCompletenessScore: decimal("data_completeness_score", { precision: 5, scale: 2 }), // 0-100
  clicked: boolean("clicked").default(false),
  timeToClick: integer("time_to_click"), // milliseconds from result display
  conversionAction: varchar("conversion_action"), // contacted, saved, campaign_added
  resultSource: varchar("result_source"), // apollo, zoominfo, hunter, mock
  resultMetadata: jsonb("result_metadata"), // Additional result context
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchSessions = pgTable("search_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionStart: timestamp("session_start").defaultNow(),
  sessionEnd: timestamp("session_end"),
  totalQueries: integer("total_queries").default(0),
  totalResults: integer("total_results").default(0),
  totalClicks: integer("total_clicks").default(0),
  totalConversions: integer("total_conversions").default(0),
  averageQualityScore: decimal("average_quality_score", { precision: 5, scale: 2 }),
  searchGoal: varchar("search_goal"), // research, outreach, list_building
  goalAchieved: boolean("goal_achieved").default(false),
  deviceType: varchar("device_type"), // desktop, mobile, tablet
  browserInfo: text("browser_info"),
  referralSource: varchar("referral_source"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchOptimizations = pgTable("search_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalQuery: text("original_query").notNull(),
  optimizedQuery: text("optimized_query").notNull(),
  optimizationType: varchar("optimization_type").notNull(), // spelling, synonym, expansion, refinement
  improvementScore: decimal("improvement_score", { precision: 5, scale: 2 }), // Expected improvement 0-100
  automationLevel: varchar("automation_level").default("suggestion"), // suggestion, auto_applied, user_approved
  applied: boolean("applied").default(false),
  resultsImprovement: decimal("results_improvement", { precision: 5, scale: 2 }), // Actual improvement if applied
  feedback: varchar("feedback"), // user feedback: helpful, not_helpful, ignored
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchInsights = pgTable("search_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  insightType: varchar("insight_type").notNull(), // trend, pattern, recommendation, alert
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority").default("medium"), // high, medium, low
  category: varchar("category"), // performance, quality, behavior, optimization
  dataPoints: jsonb("data_points"), // Supporting analytics data
  actionable: boolean("actionable").default(true),
  actionTaken: boolean("action_taken").default(false),
  dismissedAt: timestamp("dismissed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email Verification tables for CARD-013
export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  status: varchar("status").notNull(), // valid, invalid, risky, unknown, error
  subStatus: varchar("sub_status"),
  deliverabilityScore: integer("deliverability_score").notNull().default(0),
  riskLevel: varchar("risk_level").notNull().default('unknown'), // low, medium, high, very_high
  freeEmail: boolean("free_email").default(false),
  disposableEmail: boolean("disposable_email").default(false),
  roleAccount: boolean("role_account").default(false),
  toxicDomain: boolean("toxic_domain").default(false),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  gender: varchar("gender"),
  location: varchar("location"),
  suggestion: varchar("suggestion"),
  mxRecord: varchar("mx_record"),
  smtpProvider: varchar("smtp_provider"),
  creditsUsed: integer("credits_used").default(1),
  verifiedAt: timestamp("verified_at").defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bulkEmailVerifications = pgTable("bulk_email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchName: varchar("batch_name"),
  totalEmails: integer("total_emails").notNull(),
  processedEmails: integer("processed_emails").notNull(),
  validEmails: integer("valid_emails").notNull().default(0),
  invalidEmails: integer("invalid_emails").notNull().default(0),
  riskyEmails: integer("risky_emails").notNull().default(0),
  unknownEmails: integer("unknown_emails").notNull().default(0),
  disposableEmails: integer("disposable_emails").notNull().default(0),
  deliverabilityRate: integer("deliverability_rate").notNull().default(0),
  averageScore: integer("average_score").notNull().default(0),
  totalCreditsUsed: integer("total_credits_used").notNull().default(0),
  cacheHits: integer("cache_hits").notNull().default(0),
  apiCalls: integer("api_calls").notNull().default(0),
  processingTimeMs: integer("processing_time_ms"),
  status: varchar("status").notNull().default('completed'), // processing, completed, failed
  errorMessage: text("error_message"),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CARD-029: Message Optimization Tables
export const messageABTests = pgTable("message_ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  testName: varchar("test_name").notNull(),
  testType: varchar("test_type").notNull(), // subject_line, content, cta, tone, length, timing
  hypothesis: text("hypothesis").notNull(),
  testDescription: text("test_description"),
  
  // Test configuration
  sampleSize: integer("sample_size").notNull(),
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }).default("95.00"), // 90, 95, 99
  minDetectableEffect: decimal("min_detectable_effect", { precision: 5, scale: 2 }).default("5.00"), // 5%
  trafficSplit: jsonb("traffic_split").default(sql`'{"A": 50, "B": 50}'::jsonb`), // {"A": 50, "B": 30, "C": 20}
  
  // Test status and timing
  status: varchar("status").default("draft"), // draft, running, paused, completed, cancelled
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  plannedDuration: integer("planned_duration"), // hours
  
  // Results and statistical significance
  winningVariant: varchar("winning_variant"), // A, B, C
  pValue: decimal("p_value", { precision: 10, scale: 8 }),
  statisticallySignificant: boolean("statistically_significant").default(false),
  confidenceInterval: jsonb("confidence_interval"), // {"lower": 0.05, "upper": 0.15}
  
  // Metadata
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageVariants = pgTable("message_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => messageABTests.id),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  variantName: varchar("variant_name").notNull(), // A, B, C, Control, Treatment_1
  variantType: varchar("variant_type").notNull(), // control, treatment
  
  // Variant configuration
  changes: jsonb("changes").notNull(), // {"subject": "New Subject", "tone": "casual"}
  changeSummary: text("change_summary"),
  
  // Performance metrics
  sent: integer("sent").default(0),
  delivered: integer("delivered").default(0),
  opened: integer("opened").default(0),
  clicked: integer("clicked").default(0),
  replied: integer("replied").default(0),
  converted: integer("converted").default(0),
  bounced: integer("bounced").default(0),
  unsubscribed: integer("unsubscribed").default(0),
  
  // Calculated rates
  deliveryRate: decimal("delivery_rate", { precision: 5, scale: 4 }).default("0.0000"),
  openRate: decimal("open_rate", { precision: 5, scale: 4 }).default("0.0000"),
  clickRate: decimal("click_rate", { precision: 5, scale: 4 }).default("0.0000"),
  responseRate: decimal("response_rate", { precision: 5, scale: 4 }).default("0.0000"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }).default("0.0000"),
  
  // Effectiveness scoring
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messagePerformanceMetrics = pgTable("message_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  variantId: varchar("variant_id").references(() => messageVariants.id),
  
  // Detailed performance tracking
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  firstOpenedAt: timestamp("first_opened_at"),
  lastOpenedAt: timestamp("last_opened_at"),
  firstClickedAt: timestamp("first_clicked_at"),
  repliedAt: timestamp("replied_at"),
  convertedAt: timestamp("converted_at"),
  
  // Engagement metrics
  totalOpens: integer("total_opens").default(0),
  totalClicks: integer("total_clicks").default(0),
  timeToFirstOpen: integer("time_to_first_open"), // minutes
  timeToFirstClick: integer("time_to_first_click"), // minutes
  timeToReply: integer("time_to_reply"), // minutes
  engagementDuration: integer("engagement_duration"), // seconds
  
  // Context and metadata
  deviceType: varchar("device_type"), // desktop, mobile, tablet
  emailClient: varchar("email_client"), // gmail, outlook, apple_mail
  timezone: varchar("timezone"),
  dayOfWeek: integer("day_of_week"), // 0-6 (Sunday = 0)
  hourOfDay: integer("hour_of_day"), // 0-23
  
  // Delivery information
  deliveryStatus: varchar("delivery_status"), // delivered, bounced, rejected
  bounceType: varchar("bounce_type"), // hard, soft, spam
  bounceReason: text("bounce_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageOptimizationRules = pgTable("message_optimization_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  ruleName: varchar("rule_name").notNull(),
  ruleType: varchar("rule_type").notNull(), // auto_pause, auto_promote, auto_adjust, alert
  
  // Rule conditions
  conditions: jsonb("conditions").notNull(), // {"open_rate": {"<": 5}, "sample_size": {">": 100}}
  triggers: jsonb("triggers").notNull(), // {"time": "24h", "significance": 0.05}
  
  // Rule actions
  actions: jsonb("actions").notNull(), // {"promote_winner": true, "pause_losers": true}
  
  // Rule configuration
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(5), // 1-10, higher = more important
  cooldownPeriod: integer("cooldown_period").default(24), // hours between applications
  
  // Execution tracking
  lastExecuted: timestamp("last_executed"),
  executionCount: integer("execution_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageEffectivenessScores = pgTable("message_effectiveness_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Core effectiveness metrics
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  conversionScore: decimal("conversion_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  
  // Detailed scoring breakdown
  subjectLineScore: decimal("subject_line_score", { precision: 5, scale: 2 }).default("0.00"),
  contentScore: decimal("content_score", { precision: 5, scale: 2 }).default("0.00"),
  ctaScore: decimal("cta_score", { precision: 5, scale: 2 }).default("0.00"),
  personalizationScore: decimal("personalization_score", { precision: 5, scale: 2 }).default("0.00"),
  timingScore: decimal("timing_score", { precision: 5, scale: 2 }).default("0.00"),
  
  // AI analysis
  aiInsights: jsonb("ai_insights"), // AI-generated insights and recommendations
  improvementSuggestions: text("improvement_suggestions").array().default(sql`ARRAY[]::text[]`),
  strengths: text("strengths").array().default(sql`ARRAY[]::text[]`),
  weaknesses: text("weaknesses").array().default(sql`ARRAY[]::text[]`),
  
  // Benchmarking
  industryBenchmarkScore: decimal("industry_benchmark_score", { precision: 5, scale: 2 }),
  campaignBenchmarkScore: decimal("campaign_benchmark_score", { precision: 5, scale: 2 }),
  
  // Score confidence and metadata
  scoreConfidence: decimal("score_confidence", { precision: 5, scale: 2 }).default("100.00"), // 0-100
  scoringModel: varchar("scoring_model").default("v1.0"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageOptimizationInsights = pgTable("message_optimization_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  insightType: varchar("insight_type").notNull(), // performance_trend, optimization_opportunity, best_practice
  
  // Insight content
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  actionable: boolean("actionable").default(true),
  impactLevel: varchar("impact_level").default("medium"), // low, medium, high, critical
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("100.00"), // 0-100
  
  // Data sources
  dataPoints: jsonb("data_points"), // Supporting data for the insight
  relatedMessages: text("related_messages").array().default(sql`ARRAY[]::text[]`),
  relatedTests: text("related_tests").array().default(sql`ARRAY[]::text[]`),
  
  // Recommendations
  recommendations: jsonb("recommendations"), // Specific recommendations based on insight
  estimatedImpact: decimal("estimated_impact", { precision: 5, scale: 2 }), // Expected improvement %
  
  // Status and tracking
  status: varchar("status").default("new"), // new, acknowledged, implemented, dismissed
  implementedAt: timestamp("implemented_at"),
  dismissedAt: timestamp("dismissed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  prospects: many(prospects),
  campaigns: many(campaigns),
  messages: many(messages),
  analytics: many(analytics),
  emailVerifications: many(emailVerifications),
  bulkEmailVerifications: many(bulkEmailVerifications),
  searchQueries: many(searchQueries),
  searchSessions: many(searchSessions),
  searchOptimizations: many(searchOptimizations),
  searchInsights: many(searchInsights),
  messageABTests: many(messageABTests),
  messageOptimizationRules: many(messageOptimizationRules),
  messageEffectivenessScores: many(messageEffectivenessScores),
  messageOptimizationInsights: many(messageOptimizationInsights),
}));

export const prospectsRelations: any = relations(prospects, ({ one, many }) => ({
  user: one(users, {
    fields: [prospects.userId],
    references: [users.id],
  }),
  campaignProspects: many(campaignProspects),
  messages: many(messages),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  campaignProspects: many(campaignProspects),
  messages: many(messages),
  analytics: many(analytics),
}));

export const campaignProspectsRelations = relations(campaignProspects, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignProspects.campaignId],
    references: [campaigns.id],
  }),
  prospect: one(prospects, {
    fields: [campaignProspects.prospectId],
    references: [prospects.id],
  }),
}));

export const messagesRelations: any = relations(messages, ({ one, many }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  prospect: one(prospects, {
    fields: [messages.prospectId],
    references: [prospects.id],
  }),
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
  messageVariants: many(messageVariants),
  performanceMetrics: many(messagePerformanceMetrics),
  effectivenessScores: many(messageEffectivenessScores),
}));

// Message optimization relations
export const messageABTestsRelations = relations(messageABTests, ({ one, many }) => ({
  user: one(users, {
    fields: [messageABTests.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [messageABTests.campaignId],
    references: [campaigns.id],
  }),
  variants: many(messageVariants),
}));

export const messageVariantsRelations = relations(messageVariants, ({ one, many }) => ({
  test: one(messageABTests, {
    fields: [messageVariants.testId],
    references: [messageABTests.id],
  }),
  message: one(messages, {
    fields: [messageVariants.messageId],
    references: [messages.id],
  }),
  performanceMetrics: many(messagePerformanceMetrics),
}));

export const messagePerformanceMetricsRelations = relations(messagePerformanceMetrics, ({ one }) => ({
  message: one(messages, {
    fields: [messagePerformanceMetrics.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messagePerformanceMetrics.userId],
    references: [users.id],
  }),
  variant: one(messageVariants, {
    fields: [messagePerformanceMetrics.variantId],
    references: [messageVariants.id],
  }),
}));

export const messageOptimizationRulesRelations = relations(messageOptimizationRules, ({ one }) => ({
  user: one(users, {
    fields: [messageOptimizationRules.userId],
    references: [users.id],
  }),
}));

export const messageEffectivenessScoresRelations = relations(messageEffectivenessScores, ({ one }) => ({
  message: one(messages, {
    fields: [messageEffectivenessScores.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageEffectivenessScores.userId],
    references: [users.id],
  }),
}));

export const messageOptimizationInsightsRelations = relations(messageOptimizationInsights, ({ one }) => ({
  user: one(users, {
    fields: [messageOptimizationInsights.userId],
    references: [users.id],
  }),
}));

export const analyticsRelations = relations(analytics, ({ one }) => ({
  user: one(users, {
    fields: [analytics.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [analytics.campaignId],
    references: [campaigns.id],
  }),
}));

// Search analytics relations
export const searchQueriesRelations = relations(searchQueries, ({ one, many }) => ({
  user: one(users, {
    fields: [searchQueries.userId],
    references: [users.id],
  }),
  results: many(searchResults),
}));

export const searchResultsRelations = relations(searchResults, ({ one }) => ({
  query: one(searchQueries, {
    fields: [searchResults.queryId],
    references: [searchQueries.id],
  }),
  prospect: one(prospects, {
    fields: [searchResults.prospectId],
    references: [prospects.id],
  }),
}));

export const searchSessionsRelations = relations(searchSessions, ({ one }) => ({
  user: one(users, {
    fields: [searchSessions.userId],
    references: [users.id],
  }),
}));

export const searchOptimizationsRelations = relations(searchOptimizations, ({ one }) => ({
  user: one(users, {
    fields: [searchOptimizations.userId],
    references: [users.id],
  }),
}));

export const searchInsightsRelations = relations(searchInsights, ({ one }) => ({
  user: one(users, {
    fields: [searchInsights.userId],
    references: [users.id],
  }),
}));

// Email verification relations
export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));

export const bulkEmailVerificationsRelations = relations(bulkEmailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [bulkEmailVerifications.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignProspectSchema = createInsertSchema(campaignProspects).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  createdAt: true,
});

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBulkEmailVerificationSchema = createInsertSchema(bulkEmailVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Search analytics insert schemas
export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
});

export const insertSearchResultSchema = createInsertSchema(searchResults).omit({
  id: true,
  createdAt: true,
});

export const insertSearchSessionSchema = createInsertSchema(searchSessions).omit({
  id: true,
  createdAt: true,
});

export const insertSearchOptimizationSchema = createInsertSchema(searchOptimizations).omit({
  id: true,
  createdAt: true,
});

export const insertSearchInsightSchema = createInsertSchema(searchInsights).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Prospect search history tables
export const prospectSearches = pgTable("prospect_searches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  searchQuery: jsonb("search_query").notNull(),
  resultsCount: integer("results_count").notNull(),
  aiInsights: jsonb("ai_insights"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discoveredProspects = pgTable("discovered_prospects", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => prospectSearches.id),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  location: varchar("location", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  aiScore: decimal("ai_score", { precision: 5, scale: 2 }),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  dataSources: text("data_sources").array(),
  intentSignals: jsonb("intent_signals"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ProspectSearch = typeof prospectSearches.$inferSelect;
export type InsertProspectSearch = typeof prospectSearches.$inferInsert;
export type DiscoveredProspect = typeof discoveredProspects.$inferSelect;
export type InsertDiscoveredProspect = typeof discoveredProspects.$inferInsert;

// Campaign Scheduling Tables (CARD-033)
export const campaignSchedules = pgTable("campaign_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  scheduleName: varchar("schedule_name").notNull(),
  scheduleType: varchar("schedule_type", { enum: ["immediate", "scheduled", "recurring", "optimal"] }).notNull(),
  
  // Timezone and timing
  timezone: varchar("timezone").notNull().default("UTC"),
  scheduledAt: timestamp("scheduled_at"),
  optimalSendTime: timestamp("optimal_send_time"),
  
  // Recurring schedule options
  recurringPattern: varchar("recurring_pattern", { enum: ["daily", "weekly", "monthly", "custom"] }),
  recurringConfig: jsonb("recurring_config"), // Days of week, intervals, etc.
  
  // Send window constraints
  sendWindowStart: varchar("send_window_start"), // HH:MM format
  sendWindowEnd: varchar("send_window_end"), // HH:MM format
  allowWeekends: boolean("allow_weekends").default(false),
  
  // Optimization settings
  enableOptimalTiming: boolean("enable_optimal_timing").default(true),
  optimizationGoal: varchar("optimization_goal", { enum: ["open_rate", "click_rate", "response_rate", "conversion_rate"] }).default("open_rate"),
  
  // Status and control
  status: varchar("status", { enum: ["draft", "active", "paused", "completed", "cancelled"] }).default("draft"),
  priority: integer("priority").default(5), // 1-10, higher = more important
  
  // Conflict resolution
  conflictResolution: varchar("conflict_resolution", { enum: ["queue", "override", "skip"] }).default("queue"),
  maxDailyMessages: integer("max_daily_messages").default(100),
  minMessageInterval: integer("min_message_interval").default(60), // minutes
  
  // Tracking
  totalScheduled: integer("total_scheduled").default(0),
  totalSent: integer("total_sent").default(0),
  lastSentAt: timestamp("last_sent_at"),
  nextSendAt: timestamp("next_send_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scheduledMessages = pgTable("scheduled_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => campaignSchedules.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  prospectId: varchar("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  
  // Scheduling details
  originalScheduledAt: timestamp("original_scheduled_at").notNull(),
  optimizedScheduledAt: timestamp("optimized_scheduled_at"),
  actualSentAt: timestamp("actual_sent_at"),
  
  // Status tracking
  status: varchar("status", { enum: ["pending", "optimized", "sending", "sent", "failed", "cancelled", "deferred"] }).default("pending"),
  
  // Optimization data
  timezoneOffset: integer("timezone_offset"), // minutes from UTC
  optimalSendScore: decimal("optimal_send_score", { precision: 5, scale: 2 }), // 0-100
  optimizationReason: text("optimization_reason"),
  
  // Conflict handling
  conflictsWith: varchar("conflicts_with"), // Reference to other scheduled message
  conflictResolved: boolean("conflict_resolved").default(false),
  deferredUntil: timestamp("deferred_until"),
  
  // Delivery tracking
  deliveryAttempts: integer("delivery_attempts").default(0),
  lastDeliveryAttempt: timestamp("last_delivery_attempt"),
  deliveryError: text("delivery_error"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timingOptimizations = pgTable("timing_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  prospectId: varchar("prospect_id").references(() => prospects.id),
  
  // Timing analysis
  optimalHour: integer("optimal_hour"), // 0-23
  optimalDayOfWeek: integer("optimal_day_of_week"), // 0-6 (Sunday = 0)
  optimalSendTime: timestamp("optimal_send_time"),
  
  // Performance data
  openRateByHour: jsonb("open_rate_by_hour"), // Hour -> rate mapping
  clickRateByHour: jsonb("click_rate_by_hour"),
  responseRateByHour: jsonb("response_rate_by_hour"),
  
  openRateByDay: jsonb("open_rate_by_day"), // Day -> rate mapping
  clickRateByDay: jsonb("click_rate_by_day"),
  responseRateByDay: jsonb("response_rate_by_day"),
  
  // AI insights
  aiRecommendations: jsonb("ai_recommendations"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100
  
  // Data quality
  sampleSize: integer("sample_size").default(0),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scheduleConflicts = pgTable("schedule_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  primaryScheduleId: varchar("primary_schedule_id").notNull().references(() => campaignSchedules.id),
  conflictingScheduleId: varchar("conflicting_schedule_id").notNull().references(() => campaignSchedules.id),
  
  // Conflict details
  conflictType: varchar("conflict_type", { enum: ["timing", "capacity", "prospect_overlap", "rate_limit"] }).notNull(),
  conflictDescription: text("conflict_description"),
  
  // Resolution
  resolutionStrategy: varchar("resolution_strategy", { enum: ["defer", "reschedule", "cancel", "merge"] }),
  resolutionApplied: boolean("resolution_applied").default(false),
  resolvedAt: timestamp("resolved_at"),
  
  // Impact assessment
  impactScore: decimal("impact_score", { precision: 5, scale: 2 }), // 0-100
  affectedMessages: integer("affected_messages").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertCampaignSchedule = typeof campaignSchedules.$inferInsert;
export type SelectCampaignSchedule = typeof campaignSchedules.$inferSelect;
export type InsertScheduledMessage = typeof scheduledMessages.$inferInsert;
export type SelectScheduledMessage = typeof scheduledMessages.$inferSelect;
export type InsertTimingOptimization = typeof timingOptimizations.$inferInsert;
export type SelectTimingOptimization = typeof timingOptimizations.$inferSelect;
export type InsertScheduleConflict = typeof scheduleConflicts.$inferInsert;
export type SelectScheduleConflict = typeof scheduleConflicts.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertCampaignProspect = z.infer<typeof insertCampaignProspectSchema>;
export type CampaignProspect = typeof campaignProspects.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type Analytics = typeof analytics.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertBulkEmailVerification = z.infer<typeof insertBulkEmailVerificationSchema>;
export type BulkEmailVerification = typeof bulkEmailVerifications.$inferSelect;

// Search analytics types
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchResult = z.infer<typeof insertSearchResultSchema>;
export type SearchResult = typeof searchResults.$inferSelect;
export type InsertSearchSession = z.infer<typeof insertSearchSessionSchema>;
export type SearchSession = typeof searchSessions.$inferSelect;
export type InsertSearchOptimization = z.infer<typeof insertSearchOptimizationSchema>;
export type SearchOptimization = typeof searchOptimizations.$inferSelect;
export type InsertSearchInsight = z.infer<typeof insertSearchInsightSchema>;
export type SearchInsight = typeof searchInsights.$inferSelect;

// CARD-028: Context Analysis Engine Tables

// Company intelligence profiles
export const companyProfiles = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 50 }), // startup, small, medium, large, enterprise
  
  // Company intelligence data
  businessModel: varchar("business_model", { length: 100 }), // B2B, B2C, marketplace, etc.
  revenueRange: varchar("revenue_range", { length: 50 }),
  fundingStage: varchar("funding_stage", { length: 50 }),
  techStack: text("tech_stack").array().default(sql`ARRAY[]::text[]`),
  competitorAnalysis: jsonb("competitor_analysis"),
  marketPosition: varchar("market_position", { length: 50 }), // leader, challenger, niche, follower
  
  // AI-generated insights
  contextScore: decimal("context_score", { precision: 5, scale: 2 }), // 0-100
  personalityProfile: jsonb("personality_profile"), // company culture, communication style
  decisionMakingProcess: jsonb("decision_making_process"),
  painPoints: text("pain_points").array().default(sql`ARRAY[]::text[]`),
  priorities: text("priorities").array().default(sql`ARRAY[]::text[]`),
  communicationStyle: varchar("communication_style", { length: 50 }), // formal, casual, technical
  
  // Enrichment metadata
  dataSource: varchar("data_source", { length: 50 }),
  lastAnalyzed: timestamp("last_analyzed"),
  analysisVersion: varchar("analysis_version", { length: 20 }).default("1.0"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_profiles_user_id").on(table.userId),
  index("idx_company_profiles_domain").on(table.domain),
  index("idx_company_profiles_industry").on(table.industry),
]);

// Industry trend analysis
export const industryTrends = pgTable("industry_trends", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  industry: varchar("industry", { length: 100 }).notNull(),
  
  // Trend analysis data
  marketSize: decimal("market_size", { precision: 15, scale: 2 }),
  growthRate: decimal("growth_rate", { precision: 5, scale: 2 }),
  maturityStage: varchar("maturity_stage", { length: 50 }), // emerging, growth, mature, decline
  keyDrivers: text("key_drivers").array().default(sql`ARRAY[]::text[]`),
  challenges: text("challenges").array().default(sql`ARRAY[]::text[]`),
  opportunities: text("opportunities").array().default(sql`ARRAY[]::text[]`),
  
  // Technology trends
  emergingTechnologies: text("emerging_technologies").array().default(sql`ARRAY[]::text[]`),
  disruptiveTrends: text("disruptive_trends").array().default(sql`ARRAY[]::text[]`),
  adoptionPatterns: jsonb("adoption_patterns"),
  
  // AI-generated insights
  trendScore: decimal("trend_score", { precision: 5, scale: 2 }), // 0-100
  predictiveInsights: jsonb("predictive_insights"),
  recommendedActions: text("recommended_actions").array().default(sql`ARRAY[]::text[]`),
  
  // Metadata
  analysisDate: timestamp("analysis_date").defaultNow(),
  dataSource: varchar("data_source", { length: 50 }),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_industry_trends_user_id").on(table.userId),
  index("idx_industry_trends_industry").on(table.industry),
  index("idx_industry_trends_analysis_date").on(table.analysisDate),
]);

// Context analysis results  
export const contextAnalyses = pgTable("context_analyses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  prospectId: varchar("prospect_id").references(() => prospects.id),
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id),
  
  // Analysis results
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  contextFactors: jsonb("context_factors"), // timing, relevance, readiness, authority
  personalizationOpportunities: jsonb("personalization_opportunities"),
  recommendedApproach: text("recommended_approach"),
  keyMessages: text("key_messages").array().default(sql`ARRAY[]::text[]`),
  
  // Scoring breakdown
  timingScore: decimal("timing_score", { precision: 5, scale: 2 }),
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 2 }),
  authorityScore: decimal("authority_score", { precision: 5, scale: 2 }),
  readinessScore: decimal("readiness_score", { precision: 5, scale: 2 }),
  
  // AI insights
  aiInsights: jsonb("ai_insights"),
  riskFactors: text("risk_factors").array().default(sql`ARRAY[]::text[]`),
  successFactors: text("success_factors").array().default(sql`ARRAY[]::text[]`),
  nextBestActions: text("next_best_actions").array().default(sql`ARRAY[]::text[]`),
  
  // Metadata
  analysisType: varchar("analysis_type", { length: 50 }).default("comprehensive"), // quick, comprehensive, deep
  modelVersion: varchar("model_version", { length: 20 }).default("1.0"),
  processingTime: integer("processing_time"), // milliseconds
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_context_analyses_user_id").on(table.userId),
  index("idx_context_analyses_prospect_id").on(table.prospectId),
  index("idx_context_analyses_score").on(table.overallScore),
  index("idx_context_analyses_created_at").on(table.createdAt),
]);

// Personalization context scoring
export const personalizationContexts = pgTable("personalization_contexts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  prospectId: varchar("prospect_id").references(() => prospects.id),
  contextAnalysisId: integer("context_analysis_id").references(() => contextAnalyses.id),
  
  // Personalization scores
  personalityFit: decimal("personality_fit", { precision: 5, scale: 2 }), // 0-100
  communicationStyle: varchar("communication_style", { length: 50 }),
  preferredTone: varchar("preferred_tone", { length: 50 }), // professional, casual, technical, friendly
  decisionMakingStyle: varchar("decision_making_style", { length: 50 }), // analytical, intuitive, consensus, authority
  
  // Context variables
  industryContext: jsonb("industry_context"),
  roleContext: jsonb("role_context"),
  companyContext: jsonb("company_context"),
  personalContext: jsonb("personal_context"),
  
  // Optimization factors
  messageOptimization: jsonb("message_optimization"),
  channelPreferences: text("channel_preferences").array().default(sql`ARRAY[]::text[]`),
  timingRecommendations: jsonb("timing_recommendations"),
  contentRecommendations: jsonb("content_recommendations"),
  
  // Performance tracking
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }),
  conversionProbability: decimal("conversion_probability", { precision: 5, scale: 2 }),
  engagementPrediction: jsonb("engagement_prediction"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_personalization_contexts_user_id").on(table.userId),
  index("idx_personalization_contexts_prospect_id").on(table.prospectId),
  index("idx_personalization_contexts_personality_fit").on(table.personalityFit),
]);

// Context-based message optimization
export const messageOptimizations = pgTable("message_optimizations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  messageId: varchar("message_id").references(() => messages.id),
  contextAnalysisId: integer("context_analysis_id").references(() => contextAnalyses.id),
  
  // Original vs optimized
  originalMessage: text("original_message"),
  optimizedMessage: text("optimized_message").notNull(),
  optimizationType: varchar("optimization_type", { length: 50 }), // tone, length, structure, personalization
  
  // Optimization metrics
  improvementScore: decimal("improvement_score", { precision: 5, scale: 2 }), // 0-100
  readabilityScore: decimal("readability_score", { precision: 5, scale: 2 }),
  personalizationScore: decimal("personalization_score", { precision: 5, scale: 2 }),
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }),
  
  // AI analysis
  optimizationRationale: text("optimization_rationale"),
  keyChanges: text("key_changes").array().default(sql`ARRAY[]::text[]`),
  expectedImpact: jsonb("expected_impact"),
  riskAssessment: jsonb("risk_assessment"),
  
  // A/B testing data
  testVariant: varchar("test_variant", { length: 10 }), // A, B, C
  performanceMetrics: jsonb("performance_metrics"),
  isWinner: boolean("is_winner").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_message_optimizations_user_id").on(table.userId),
  index("idx_message_optimizations_message_id").on(table.messageId),
  index("idx_message_optimizations_improvement_score").on(table.improvementScore),
  index("idx_message_optimizations_created_at").on(table.createdAt),
]);

// Create insert schemas for context analysis tables
export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIndustryTrendSchema = createInsertSchema(industryTrends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContextAnalysisSchema = createInsertSchema(contextAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonalizationContextSchema = createInsertSchema(personalizationContexts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageOptimizationSchema = createInsertSchema(messageOptimizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Context analysis types
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertIndustryTrend = z.infer<typeof insertIndustryTrendSchema>;
export type IndustryTrend = typeof industryTrends.$inferSelect;
export type InsertContextAnalysis = z.infer<typeof insertContextAnalysisSchema>;
export type ContextAnalysis = typeof contextAnalyses.$inferSelect;
export type InsertPersonalizationContext = z.infer<typeof insertPersonalizationContextSchema>;
export type PersonalizationContext = typeof personalizationContexts.$inferSelect;
export type InsertMessageOptimization = z.infer<typeof insertMessageOptimizationSchema>;
export type MessageOptimization = typeof messageOptimizations.$inferSelect;
