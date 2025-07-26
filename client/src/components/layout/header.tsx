import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";

const sectionData = {
  "/": {
    title: "Dashboard",
    description: "Overview of your lead generation performance"
  },
  "/discovery": {
    title: "Prospect Discovery",
    description: "Find and identify high-quality prospects"
  },
  "/enrichment": {
    title: "Data Enrichment",
    description: "Enhance prospect data with verified contact information"
  },
  "/personalization": {
    title: "AI Personalization",
    description: "Generate personalized messages using AI"
  },
  "/campaigns": {
    title: "Campaigns",
    description: "Manage and monitor your outreach campaigns"
  },
  "/analytics": {
    title: "Analytics",
    description: "Track performance and optimize your campaigns"
  }
};

export default function Header() {
  const [location, setLocation] = useLocation();
  const currentSection = sectionData[location as keyof typeof sectionData] || sectionData["/"];

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="section-header">
          <h1 className="text-2xl font-semibold text-slate-900" data-testid="text-section-title">
            {currentSection.title}
          </h1>
          <p className="text-slate-600 mt-1" data-testid="text-section-description">
            {currentSection.description}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="secondary" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button 
            onClick={() => setLocation("/campaigns")}
            data-testid="button-new-campaign"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>
    </header>
  );
}
