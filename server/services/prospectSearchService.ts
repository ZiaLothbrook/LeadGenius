import { z } from "zod";

// Search filters schema
export const searchFiltersSchema = z.object({
  keywords: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.enum(["1-10", "11-50", "51-200", "200+"]).optional(),
  location: z.string().optional(),
  jobTitles: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  page: z.number().default(1),
  limit: z.number().min(1).max(100).default(20),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

// Mock prospect data for different industries and companies
const MOCK_PROSPECTS_DATABASE = [
  {
    name: "Sarah Chen",
    title: "VP of Engineering",
    company: "TechFlow Solutions",
    industry: "Technology",
    location: "San Francisco, CA",
    email: "sarah.chen@techflow.com",
    phone: "+1 (415) 555-0123",
    linkedinUrl: "https://linkedin.com/in/sarahchen-eng",
    companySize: "51-200",
    dataQuality: 95,
    verified: true,
    technologies: ["React", "Node.js", "AWS", "Docker"],
    score: 88,
    priority: "high" as const,
  },
  {
    name: "Michael Rodriguez",
    title: "Chief Technology Officer", 
    company: "InnovateCorp",
    industry: "Technology",
    location: "Austin, TX",
    email: "m.rodriguez@innovatecorp.com",
    phone: "+1 (512) 555-0456",
    linkedinUrl: "https://linkedin.com/in/mrodriguez-cto",
    companySize: "200+",
    dataQuality: 92,
    verified: true,
    technologies: ["Python", "Kubernetes", "Machine Learning", "PostgreSQL"],
    score: 91,
    priority: "high" as const,
  },
  {
    name: "Jennifer Park",
    title: "Director of Operations",
    company: "HealthTech Innovations",
    industry: "Healthcare",
    location: "Boston, MA", 
    email: "j.park@healthtech.com",
    phone: "+1 (617) 555-0789",
    linkedinUrl: "https://linkedin.com/in/jennifer-park-ops",
    companySize: "11-50",
    dataQuality: 87,
    verified: true,
    technologies: ["Salesforce", "HubSpot", "Tableau"],
    score: 82,
    priority: "medium" as const,
  },
  {
    name: "David Thompson",
    title: "Head of Digital Marketing",
    company: "RetailMax Solutions",
    industry: "Retail",
    location: "Chicago, IL",
    email: "david.t@retailmax.com", 
    phone: "+1 (312) 555-0234",
    linkedinUrl: "https://linkedin.com/in/davidthompson-marketing",
    companySize: "51-200",
    dataQuality: 85,
    verified: false,
    technologies: ["Google Analytics", "Shopify", "Meta Ads"],
    score: 76,
    priority: "medium" as const,
  },
  {
    name: "Amanda Foster",
    title: "VP of Sales",
    company: "FinanceFlow Inc",
    industry: "Finance",
    location: "New York, NY",
    email: "a.foster@financeflow.com",
    phone: "+1 (212) 555-0567",
    linkedinUrl: "https://linkedin.com/in/amanda-foster-sales",
    companySize: "200+",
    dataQuality: 94,
    verified: true,
    technologies: ["Salesforce", "HubSpot", "Zoom", "Slack"],
    score: 89,
    priority: "high" as const,
  },
  {
    name: "Robert Kim",
    title: "Senior Product Manager",
    company: "CloudSync Technologies",
    industry: "Technology",
    location: "Seattle, WA",
    email: "robert.kim@cloudsync.com",
    phone: "+1 (206) 555-0890",
    linkedinUrl: "https://linkedin.com/in/robert-kim-pm",
    companySize: "51-200",
    dataQuality: 88,
    verified: true,
    technologies: ["Jira", "Slack", "Figma", "AWS"],
    score: 84,
    priority: "medium" as const,
  },
  {
    name: "Lisa Zhang",
    title: "Chief Marketing Officer",
    company: "EcoSustainable Corp",
    industry: "Manufacturing",
    location: "Portland, OR",
    email: "l.zhang@ecosustainable.com",
    phone: "+1 (503) 555-0345",
    linkedinUrl: "https://linkedin.com/in/lisa-zhang-cmo",
    companySize: "11-50",
    dataQuality: 90,
    verified: true,
    technologies: ["HubSpot", "Google Analytics", "Canva"],
    score: 86,
    priority: "high" as const,
  },
  {
    name: "James Wilson",
    title: "IT Director",
    company: "MedDevice Solutions",
    industry: "Healthcare",
    location: "Minneapolis, MN",
    email: "james.wilson@meddevice.com",
    phone: "+1 (612) 555-0678",
    linkedinUrl: "https://linkedin.com/in/james-wilson-it",
    companySize: "51-200", 
    dataQuality: 83,
    verified: false,
    technologies: ["Microsoft 365", "Azure", "PowerBI"],
    score: 78,
    priority: "medium" as const,
  },
  {
    name: "Maria Gonzalez",
    title: "Operations Manager",
    company: "LogiTrans Freight",
    industry: "Transportation",
    location: "Miami, FL",
    email: "m.gonzalez@logitrans.com",
    phone: "+1 (305) 555-0123",
    linkedinUrl: "https://linkedin.com/in/maria-gonzalez-ops",
    companySize: "11-50",
    dataQuality: 81,
    verified: false,
    technologies: ["SAP", "Excel", "GPS Tracking"],
    score: 74,
    priority: "low" as const,
  },
  {
    name: "Thomas Anderson",
    title: "Senior Software Engineer",
    company: "DataFlow Analytics",
    industry: "Technology",
    location: "Denver, CO",
    email: "t.anderson@dataflow.com",
    phone: "+1 (303) 555-0456",
    linkedinUrl: "https://linkedin.com/in/thomas-anderson-dev",
    companySize: "1-10",
    dataQuality: 86,
    verified: true,
    technologies: ["Python", "PostgreSQL", "Docker", "Kubernetes"],
    score: 80,
    priority: "medium" as const,
  },
];

export class ProspectSearchService {
  async searchProspects(filters: SearchFilters): Promise<{
    prospects: any[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    // Start with all prospects
    let filteredProspects = [...MOCK_PROSPECTS_DATABASE];

    // Apply keyword search across name, title, company
    if (filters.keywords) {
      const keywords = filters.keywords.toLowerCase();
      filteredProspects = filteredProspects.filter(prospect => 
        prospect.name.toLowerCase().includes(keywords) ||
        prospect.title.toLowerCase().includes(keywords) ||
        prospect.company.toLowerCase().includes(keywords) ||
        prospect.industry.toLowerCase().includes(keywords)
      );
    }

    // Apply industry filter
    if (filters.industry && filters.industry !== "all") {
      filteredProspects = filteredProspects.filter(prospect => 
        prospect.industry.toLowerCase() === filters.industry?.toLowerCase()
      );
    }

    // Apply company size filter
    if (filters.companySize) {
      filteredProspects = filteredProspects.filter(prospect => 
        prospect.companySize === filters.companySize
      );
    }

    // Apply location filter
    if (filters.location) {
      const location = filters.location.toLowerCase();
      filteredProspects = filteredProspects.filter(prospect => 
        prospect.location.toLowerCase().includes(location)
      );
    }

    // Apply job title filter
    if (filters.jobTitles && filters.jobTitles.length > 0) {
      filteredProspects = filteredProspects.filter(prospect => 
        filters.jobTitles!.some(title => 
          prospect.title.toLowerCase().includes(title.toLowerCase())
        )
      );
    }

    // Apply technology filter
    if (filters.technologies && filters.technologies.length > 0) {
      filteredProspects = filteredProspects.filter(prospect => 
        filters.technologies!.some(tech => 
          prospect.technologies.some(pTech => 
            pTech.toLowerCase().includes(tech.toLowerCase())
          )
        )
      );
    }

    // Sort by score (highest first)
    filteredProspects.sort((a, b) => b.score - a.score);

    // Pagination
    const total = filteredProspects.length;
    const totalPages = Math.ceil(total / filters.limit);
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedProspects = filteredProspects.slice(startIndex, endIndex);

    // Add unique IDs for each prospect
    const prospectsWithIds = paginatedProspects.map((prospect, index) => ({
      id: `search_${startIndex + index + 1}`,
      ...prospect,
      source: "ProspectDB" as const,
      lastUpdated: new Date().toISOString(),
    }));

    return {
      prospects: prospectsWithIds,
      total,
      page: filters.page,
      totalPages,
      hasMore: filters.page < totalPages,
    };
  }

  // Get available filter options for frontend
  getFilterOptions() {
    const industries = [...new Set(MOCK_PROSPECTS_DATABASE.map(p => p.industry))];
    const locations = [...new Set(MOCK_PROSPECTS_DATABASE.map(p => p.location.split(", ")[1]))]; // States
    const technologies = [...new Set(MOCK_PROSPECTS_DATABASE.flatMap(p => p.technologies))];
    const jobTitles = [...new Set(MOCK_PROSPECTS_DATABASE.map(p => p.title))];

    return {
      industries: industries.sort(),
      locations: locations.sort(),
      technologies: technologies.sort(),
      jobTitles: jobTitles.sort(),
      companySizes: ["1-10", "11-50", "51-200", "200+"],
    };
  }
}

export const prospectSearchService = new ProspectSearchService();