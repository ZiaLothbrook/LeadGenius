import {
  users,
  prospects,
  campaigns,
  messages,
  campaignProspects,
  analytics,
  emailVerifications,
  bulkEmailVerifications,
  searchQueries,
  searchResults,
  searchSessions,
  searchOptimizations,
  searchInsights,
  type User,
  type InsertUser,
  type UpsertUser,
  type Prospect,
  type InsertProspect,
  type Campaign,
  type InsertCampaign,
  type Message,
  type InsertMessage,
  type CampaignProspect,
  type InsertCampaignProspect,
  type Analytics,
  type InsertAnalytics,
  type EmailVerification,
  type InsertEmailVerification,
  type BulkEmailVerification,
  type InsertBulkEmailVerification,
  type SearchQuery,
  type InsertSearchQuery,
  type SearchResult,
  type InsertSearchResult,
  type SearchSession,
  type InsertSearchSession,
  type SearchOptimization,
  type InsertSearchOptimization,
  type SearchInsight,
  type InsertSearchInsight,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Prospect operations
  getProspects(userId: string, filters?: any): Promise<Prospect[]>;
  getProspectsByUserId(userId: string): Promise<Prospect[]>;
  getProspect(id: string): Promise<Prospect | undefined>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspect(id: string, prospect: Partial<Prospect>): Promise<Prospect>;
  deleteProspect(id: string): Promise<void>;
  
  // Multi-source data integration operations
  getProspectsByDeduplicationHash(hash: string): Promise<Prospect[]>;
  getMasterProspects(userId: string): Promise<Prospect[]>;
  getDuplicateProspects(userId: string): Promise<Prospect[]>;
  
  // Campaign operations
  getCampaigns(userId: string): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;
  
  // Message operations
  getMessages(userId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, message: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
  
  // Campaign Prospect operations
  getCampaignProspects(campaignId: string): Promise<CampaignProspect[]>;
  createCampaignProspect(campaignProspect: InsertCampaignProspect): Promise<CampaignProspect>;
  updateCampaignProspect(id: string, campaignProspect: Partial<CampaignProspect>): Promise<CampaignProspect>;
  
  // Analytics operations
  getAnalytics(userId: string, filters?: any): Promise<Analytics[]>;
  createAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
  getDashboardStats(userId: string): Promise<any>;

  // Email Verification operations (CARD-013)
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  createBulkEmailVerifications(verifications: InsertEmailVerification[]): Promise<void>;
  getEmailVerificationHistory(userId: string, limit?: number): Promise<EmailVerification[]>;
  getBulkEmailVerificationHistory(userId: string, limit?: number): Promise<BulkEmailVerification[]>;
  getEmailVerificationStats(userId: string): Promise<any>;
  getRecentEmailVerification(email: string, userId: string, cutoff: Date): Promise<EmailVerification | null>;
  getRecentlyVerifiedEmails(emails: string[], userId: string, cutoff: Date): Promise<EmailVerification[]>;
  createBulkEmailVerification(bulk: InsertBulkEmailVerification): Promise<BulkEmailVerification>;
  updateBulkEmailVerification(id: string, updates: Partial<BulkEmailVerification>): Promise<BulkEmailVerification>;
  updateProspectEmailStatus(email: string, status: string, userId: string): Promise<void>;
  updateProspectsEmailStatuses(updates: { email: string; status: string }[], userId: string): Promise<void>;

  // Search analytics operations (CARD-025)
  getSearchQueries(userId: string, limit?: number): Promise<SearchQuery[]>;
  getSearchQuery(id: string, userId: string): Promise<SearchQuery | undefined>;
  createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery>;
  getSearchResults(queryId: string, userId: string): Promise<SearchResult[]>;
  createSearchResults(results: InsertSearchResult[]): Promise<SearchResult[]>;
  getSearchSessions(userId: string, limit?: number): Promise<SearchSession[]>;
  getSearchSession(id: string, userId: string): Promise<SearchSession | undefined>;
  createSearchSession(session: InsertSearchSession): Promise<SearchSession>;
  getSearchOptimizations(userId: string, limit?: number): Promise<SearchOptimization[]>;
  getSearchInsights(userId: string, limit?: number): Promise<SearchInsight[]>;
  applySearchOptimization(id: string, userId: string, feedback?: string): Promise<SearchOptimization | undefined>;
  dismissSearchInsight(id: string, userId: string): Promise<SearchInsight | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Prospect operations
  async getProspects(userId: string, filters?: any): Promise<Prospect[]> {
    let conditions = [eq(prospects.userId, userId)];
    
    if (filters?.search) {
      conditions.push(
        sql`${prospects.name} ILIKE ${`%${filters.search}%`} OR 
            ${prospects.company} ILIKE ${`%${filters.search}%`} OR 
            ${prospects.email} ILIKE ${`%${filters.search}%`}`
      );
    }
    
    if (filters?.industry && filters.industry !== 'all') {
      conditions.push(eq(prospects.industry, filters.industry));
    }
    
    if (filters?.location) {
      conditions.push(sql`${prospects.location} ILIKE ${`%${filters.location}%`}`);
    }
    
    return await db.select().from(prospects)
      .where(and(...conditions))
      .orderBy(desc(prospects.createdAt));
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
    return prospect;
  }

  async createProspect(prospect: InsertProspect): Promise<Prospect> {
    const [newProspect] = await db.insert(prospects).values(prospect).returning();
    return newProspect;
  }

  async updateProspect(id: string, prospect: Partial<Prospect>): Promise<Prospect> {
    const [updatedProspect] = await db
      .update(prospects)
      .set({ ...prospect, updatedAt: new Date() })
      .where(eq(prospects.id, id))
      .returning();
    return updatedProspect;
  }

  async deleteProspect(id: string): Promise<void> {
    await db.delete(prospects).where(eq(prospects.id, id));
  }

  async getProspectsByUserId(userId: string): Promise<Prospect[]> {
    const userProspects = await db.select().from(prospects).where(eq(prospects.userId, userId));
    return userProspects;
  }

  async getProspectsByDeduplicationHash(hash: string): Promise<Prospect[]> {
    const duplicateProspects = await db.select().from(prospects).where(eq(prospects.deduplicationHash, hash));
    return duplicateProspects;
  }

  async getMasterProspects(userId: string): Promise<Prospect[]> {
    const masterProspects = await db.select().from(prospects).where(
      and(eq(prospects.userId, userId), eq(prospects.masterRecord, true))
    );
    return masterProspects;
  }

  async getDuplicateProspects(userId: string): Promise<Prospect[]> {
    const duplicateProspects = await db.select().from(prospects).where(
      and(eq(prospects.userId, userId), eq(prospects.masterRecord, false))
    );
    return duplicateProspects;
  }

  // Campaign operations
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaign(id: string, campaign: Partial<Campaign>): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ ...campaign, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  // Message operations
  async getMessages(userId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt));
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async updateMessage(id: string, message: Partial<Message>): Promise<Message> {
    const [updatedMessage] = await db
      .update(messages)
      .set(message)
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  // Campaign Prospect operations
  async getCampaignProspects(campaignId: string): Promise<CampaignProspect[]> {
    return await db
      .select()
      .from(campaignProspects)
      .where(eq(campaignProspects.campaignId, campaignId))
      .orderBy(desc(campaignProspects.createdAt));
  }

  async getCampaignProspectsWithDetails(campaignId: string): Promise<Prospect[]> {
    const campaignProspectsList = await db
      .select()
      .from(campaignProspects)
      .where(eq(campaignProspects.campaignId, campaignId))
      .orderBy(desc(campaignProspects.createdAt));
    
    const prospectIds = campaignProspectsList.map(cp => cp.prospectId);
    if (prospectIds.length === 0) return [];
    
    return await db
      .select()
      .from(prospects)
      .where(sql`${prospects.id} IN ${prospectIds}`);
  }

  async createCampaignProspect(campaignProspect: InsertCampaignProspect): Promise<CampaignProspect> {
    const [newCampaignProspect] = await db
      .insert(campaignProspects)
      .values(campaignProspect)
      .returning();
    return newCampaignProspect;
  }

  async updateCampaignProspect(id: string, campaignProspect: Partial<CampaignProspect>): Promise<CampaignProspect> {
    const [updatedCampaignProspect] = await db
      .update(campaignProspects)
      .set(campaignProspect)
      .where(eq(campaignProspects.id, id))
      .returning();
    return updatedCampaignProspect;
  }

  // Analytics operations
  async getAnalytics(userId: string, filters?: any): Promise<Analytics[]> {
    let conditions = [eq(analytics.userId, userId)];
    
    if (filters?.campaignId) {
      conditions.push(eq(analytics.campaignId, filters.campaignId));
    }
    
    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        sql`${analytics.date} >= ${filters.startDate}`,
        sql`${analytics.date} <= ${filters.endDate}`
      );
    }
    
    return await db.select().from(analytics)
      .where(and(...conditions))
      .orderBy(desc(analytics.date));
  }

  async createAnalytics(analyticsData: InsertAnalytics): Promise<Analytics> {
    const [newAnalytics] = await db.insert(analytics).values(analyticsData).returning();
    return newAnalytics;
  }

  async getDashboardStats(userId: string): Promise<any> {
    // Get total prospects count
    const totalProspects = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospects)
      .where(eq(prospects.userId, userId));

    // Get active campaigns count
    const activeCampaigns = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, "active")));

    // Get total sent messages
    const totalSent = await db
      .select({ total: sql<number>`coalesce(sum(sent), 0)` })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    // Get total opened messages
    const totalOpened = await db
      .select({ total: sql<number>`coalesce(sum(opened), 0)` })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    // Get total replied messages
    const totalReplied = await db
      .select({ total: sql<number>`coalesce(sum(replied), 0)` })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    // Get total converted messages
    const totalConverted = await db
      .select({ total: sql<number>`coalesce(sum(converted), 0)` })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    const sent = totalSent[0]?.total || 0;
    const opened = totalOpened[0]?.total || 0;
    const replied = totalReplied[0]?.total || 0;
    const converted = totalConverted[0]?.total || 0;

    return {
      totalProspects: totalProspects[0]?.count || 0,
      activeCampaigns: activeCampaigns[0]?.count || 0,
      totalSent: sent,
      openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0.0",
      responseRate: sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0",
      conversionRate: sent > 0 ? ((converted / sent) * 100).toFixed(1) : "0.0",
    };
  }

  // Email Verification operations (CARD-013)
  async createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification> {
    const [result] = await db
      .insert(emailVerifications)
      .values({
        ...verification,
        verifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async createBulkEmailVerifications(verifications: InsertEmailVerification[]): Promise<void> {
    if (verifications.length === 0) return;
    
    const now = new Date();
    const verificationData = verifications.map(v => ({
      ...v,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(emailVerifications).values(verificationData);
  }

  async getEmailVerificationHistory(userId: string, limit: number = 50): Promise<EmailVerification[]> {
    return await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.userId, userId))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(limit);
  }

  async getBulkEmailVerificationHistory(userId: string, limit: number = 20): Promise<BulkEmailVerification[]> {
    return await db
      .select()
      .from(bulkEmailVerifications)
      .where(eq(bulkEmailVerifications.userId, userId))
      .orderBy(desc(bulkEmailVerifications.createdAt))
      .limit(limit);
  }

  async getEmailVerificationStats(userId: string): Promise<any> {
    // Get verification stats
    const stats = await db
      .select({
        totalVerifications: sql<number>`count(*)`,
        validEmails: sql<number>`sum(case when status = 'valid' then 1 else 0 end)`,
        invalidEmails: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)`,
        riskyEmails: sql<number>`sum(case when status = 'risky' then 1 else 0 end)`,
        unknownEmails: sql<number>`sum(case when status = 'unknown' then 1 else 0 end)`,
        averageScore: sql<number>`avg(deliverability_score)`,
        totalCreditsUsed: sql<number>`sum(credits_used)`,
        lastVerification: sql<string>`max(verified_at)`,
      })
      .from(emailVerifications)
      .where(eq(emailVerifications.userId, userId));

    // Get top risk factors
    const riskFactors = await db
      .select({
        factor: sql<string>`
          case 
            when disposable_email = true then 'Disposable Email'
            when toxic_domain = true then 'Toxic Domain'
            when role_account = true then 'Role Account'
            when free_email = true then 'Free Email'
            else 'Other'
          end
        `,
        count: sql<number>`count(*)`
      })
      .from(emailVerifications)
      .where(and(
        eq(emailVerifications.userId, userId),
        sql`(disposable_email = true OR toxic_domain = true OR role_account = true OR free_email = true)`
      ))
      .groupBy(sql`
        case 
          when disposable_email = true then 'Disposable Email'
          when toxic_domain = true then 'Toxic Domain'
          when role_account = true then 'Role Account'
          when free_email = true then 'Free Email'
          else 'Other'
        end
      `)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    return {
      ...stats[0],
      topRiskFactors: riskFactors.map(rf => rf.factor)
    };
  }

  async getRecentEmailVerification(email: string, userId: string, cutoff: Date): Promise<EmailVerification | null> {
    const [result] = await db
      .select()
      .from(emailVerifications)
      .where(and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.userId, userId),
        sql`verified_at >= ${cutoff}`
      ))
      .orderBy(desc(emailVerifications.verifiedAt))
      .limit(1);
    
    return result || null;
  }

  async getRecentlyVerifiedEmails(emails: string[], userId: string, cutoff: Date): Promise<EmailVerification[]> {
    if (emails.length === 0) return [];
    
    return await db
      .select()
      .from(emailVerifications)
      .where(and(
        sql`email = ANY(${emails})`,
        eq(emailVerifications.userId, userId),
        sql`verified_at >= ${cutoff}`
      ))
      .orderBy(desc(emailVerifications.verifiedAt));
  }

  async createBulkEmailVerification(bulk: InsertBulkEmailVerification): Promise<BulkEmailVerification> {
    const [result] = await db
      .insert(bulkEmailVerifications)
      .values({
        ...bulk,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async updateBulkEmailVerification(id: string, updates: Partial<BulkEmailVerification>): Promise<BulkEmailVerification> {
    const [result] = await db
      .update(bulkEmailVerifications)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(bulkEmailVerifications.id, id))
      .returning();
    return result;
  }

  async updateProspectEmailStatus(email: string, status: string, userId: string): Promise<void> {
    await db
      .update(prospects)
      .set({
        emailStatus: status,
        updatedAt: new Date(),
      })
      .where(and(
        eq(prospects.email, email),
        eq(prospects.userId, userId)
      ));
  }

  async updateProspectsEmailStatuses(updates: { email: string; status: string }[], userId: string): Promise<void> {
    if (updates.length === 0) return;

    // Use a transaction for batch updates
    for (const update of updates) {
      await this.updateProspectEmailStatus(update.email, update.status, userId);
    }
  }

  // Search analytics operations (CARD-025)
  async getSearchQueries(userId: string, limit: number = 50): Promise<SearchQuery[]> {
    return await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .orderBy(desc(searchQueries.createdAt))
      .limit(limit);
  }

  async getSearchQuery(id: string, userId: string): Promise<SearchQuery | undefined> {
    const [query] = await db
      .select()
      .from(searchQueries)
      .where(and(eq(searchQueries.id, id), eq(searchQueries.userId, userId)));
    return query;
  }

  async createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery> {
    const [created] = await db.insert(searchQueries).values(query).returning();
    return created;
  }

  async getSearchResults(queryId: string, userId: string): Promise<SearchResult[]> {
    return await db
      .select()
      .from(searchResults)
      .innerJoin(searchQueries, eq(searchResults.queryId, searchQueries.id))
      .where(and(eq(searchResults.queryId, queryId), eq(searchQueries.userId, userId)))
      .then(rows => rows.map(row => row.search_results));
  }

  async createSearchResults(results: InsertSearchResult[]): Promise<SearchResult[]> {
    if (results.length === 0) return [];
    return await db.insert(searchResults).values(results).returning();
  }

  async getSearchSessions(userId: string, limit: number = 20): Promise<SearchSession[]> {
    return await db
      .select()
      .from(searchSessions)
      .where(eq(searchSessions.userId, userId))
      .orderBy(desc(searchSessions.sessionStart))
      .limit(limit);
  }

  async getSearchSession(id: string, userId: string): Promise<SearchSession | undefined> {
    const [session] = await db
      .select()
      .from(searchSessions)
      .where(and(eq(searchSessions.id, id), eq(searchSessions.userId, userId)));
    return session;
  }

  async createSearchSession(session: InsertSearchSession): Promise<SearchSession> {
    const [created] = await db.insert(searchSessions).values(session).returning();
    return created;
  }

  async getSearchOptimizations(userId: string, limit: number = 10): Promise<SearchOptimization[]> {
    return await db
      .select()
      .from(searchOptimizations)
      .where(and(
        eq(searchOptimizations.userId, userId),
        eq(searchOptimizations.applied, false)
      ))
      .orderBy(desc(searchOptimizations.improvementScore))
      .limit(limit);
  }

  async getSearchInsights(userId: string, limit: number = 20): Promise<SearchInsight[]> {
    return await db
      .select()
      .from(searchInsights)
      .where(and(
        eq(searchInsights.userId, userId),
        sql`dismissed_at IS NULL`
      ))
      .orderBy(desc(searchInsights.createdAt))
      .limit(limit);
  }

  async applySearchOptimization(id: string, userId: string, feedback?: string): Promise<SearchOptimization | undefined> {
    const [optimization] = await db
      .update(searchOptimizations)
      .set({
        applied: true,
        feedback: feedback || null,
      })
      .where(and(
        eq(searchOptimizations.id, id),
        eq(searchOptimizations.userId, userId)
      ))
      .returning();
    return optimization;
  }

  async dismissSearchInsight(id: string, userId: string): Promise<SearchInsight | undefined> {
    const [insight] = await db
      .update(searchInsights)
      .set({
        dismissedAt: new Date(),
      })
      .where(and(
        eq(searchInsights.id, id),
        eq(searchInsights.userId, userId)
      ))
      .returning();
    return insight;
  }
}

// Create admin user function for storage initialization
const createAdminUser = async () => {
  try {
    const storage = new DatabaseStorage();
    const existingUser = await storage.getUserByUsername("admin");
    if (!existingUser) {
      await storage.createUser({
        username: "admin",
        password: "password", 
        email: "admin@company.com",
        firstName: "Admin",
        lastName: "User",
      });
      console.log("Admin user created successfully");
      
      // Add sample prospects for demo
      await createSampleProspects(storage);
    } else {
      console.log("Admin user already exists");
      
      // Check if we need to add sample prospects
      const existingProspects = await storage.getProspects(existingUser.id);
      if (existingProspects.length === 0) {
        console.log("Adding sample prospects...");
        await createSampleProspects(storage);
      }
    }
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};

// Create sample prospects for demo
const createSampleProspects = async (storage: DatabaseStorage) => {
  const adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) return;

  const sampleProspects = [
    {
      userId: adminUser.id,
      name: "Sarah Johnson",
      email: "sarah.johnson@techstart.com",
      company: "TechStart Inc",
      title: "VP of Sales",
      industry: "technology",
      location: "San Francisco, CA",
      phone: "+1 (555) 123-4567",
      linkedinUrl: "https://linkedin.com/in/sarahjohnson",
      companySize: "51-200",
      score: 85,
      verified: true,
      dataQuality: 95,
    },
    {
      userId: adminUser.id,
      name: "Michael Chen",
      email: "m.chen@healthtech.com",
      company: "HealthTech Solutions",
      title: "CEO",
      industry: "healthcare",
      location: "Boston, MA",
      phone: "+1 (555) 987-6543",
      linkedinUrl: "https://linkedin.com/in/michaelchen",
      companySize: "11-50",
      score: 92,
      verified: true,
      dataQuality: 88,
    },
    {
      userId: adminUser.id,
      name: "Emily Rodriguez",
      email: "emily.r@finnovate.com",
      company: "Finnovate Corp",
      title: "Director of Marketing",
      industry: "finance",
      location: "New York, NY",
      phone: "+1 (555) 456-7890",
      linkedinUrl: "https://linkedin.com/in/emilyrodriguez",
      companySize: "200+",
      score: 78,
      verified: false,
      dataQuality: 82,
    },
    {
      userId: adminUser.id,
      name: "David Kim",
      email: "david.kim@manufact.com",
      company: "Manufacturing Plus",
      title: "Operations Manager",
      industry: "manufacturing",
      location: "Detroit, MI",
      phone: "+1 (555) 321-0987",
      linkedinUrl: "https://linkedin.com/in/davidkim",
      companySize: "51-200",
      score: 67,
      verified: true,
      dataQuality: 75,
    },
    {
      userId: adminUser.id,
      name: "Lisa Wang",
      email: "lisa.wang@techcorp.com",
      company: "TechCorp Industries",
      title: "CTO",
      industry: "technology",
      location: "Seattle, WA",
      phone: "+1 (555) 111-2222",
      linkedinUrl: "https://linkedin.com/in/lisawang",
      companySize: "200+",
      score: 94,
      verified: true,
      dataQuality: 96,
    }
  ];

  try {
    for (const prospect of sampleProspects) {
      await storage.createProspect(prospect);
    }
    console.log("Sample prospects created successfully");
  } catch (error) {
    console.log("Sample prospects already exist or error creating them");
  }
};

export const storage = new DatabaseStorage();

// Initialize admin user and sample data
createAdminUser();
