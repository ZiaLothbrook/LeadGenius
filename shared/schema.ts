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

export const messagesRelations: any = relations(messages, ({ one }) => ({
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
