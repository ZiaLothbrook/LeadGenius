import {
  users,
  prospects,
  campaigns,
  messages,
  campaignProspects,
  analytics,
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
