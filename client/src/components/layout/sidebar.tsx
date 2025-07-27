import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Database, 
  Search, 
  Zap, 
  Send, 
  PieChart,
  Key,
  Rocket,
  LogOut,
  User,
  Mail,
  Users,
  Brain,
  Target,
  Calendar,
  Activity,
  Shield
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    name: "Prospect Discovery",
    href: "/discovery",
    icon: Search,
  },
  {
    name: "Data Enrichment",
    href: "/enrichment",
    icon: Database,
  },
  {
    name: "AI Personalization",
    href: "/personalization",
    icon: Zap,
  },
  {
    name: "Context Analysis",
    href: "/context-analysis",
    icon: Brain,
  },
  {
    name: "Message Optimization",
    href: "/message-optimization",
    icon: Target,
  },
  {
    name: "Campaign Scheduling",
    href: "/campaign-scheduling",
    icon: Calendar,
  },
  {
    name: "Response Detection",
    href: "/response-detection",
    icon: Activity,
  },
  {
    name: "Deliverability Monitoring",
    href: "/deliverability-monitoring",
    icon: Shield,
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: Send,
  },
  {
    name: "Email Delivery",
    href: "/email-delivery",
    icon: Mail,
  },
  {
    name: "LinkedIn",
    href: "/linkedin",
    icon: Users,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: PieChart,
  },
  {
    name: "Search Analytics",
    href: "/search-analytics",
    icon: BarChart3,
  },
  {
    name: "API Keys",
    href: "/apis",
    icon: Key,
  },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Rocket className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-slate-900">LeadGen AI</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <button
              key={item.name}
              onClick={() => setLocation(item.href)}
              className={cn(
                "nav-item w-full text-left",
                isActive && "active"
              )}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.profileImageUrl || ""} />
            <AvatarFallback>
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate" data-testid="text-user-name">
              {user?.firstName || user?.email || "User"}
            </p>
            <p className="text-xs text-slate-500 truncate" data-testid="text-user-email">
              {user?.email || "user@company.com"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              window.location.href = '/login';
            } catch (error) {
              console.error('Logout failed:', error);
            }
          }}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
