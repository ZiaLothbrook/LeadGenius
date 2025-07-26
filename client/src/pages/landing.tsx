import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Search, Database, Zap, BarChart, Users, Target, Clock, TrendingUp, DollarSign } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-slate-900">LeadGen AI</span>
            </div>
            <Button 
              onClick={() => window.location.href = '/login'} 
              className="btn-primary"
              data-testid="button-login"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Intelligent Lead Generation <br />
            <span className="text-primary">Powered by AI</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Discover high-quality prospects, enrich contact data, and create personalized outreach campaigns 
            that convert—all in one unified platform.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/login'}
            className="btn-primary text-lg px-8 py-3"
            data-testid="button-hero-cta"
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Expected Outcomes Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">
            Proven Results You Can Count On
          </h2>
          <p className="text-lg text-center text-slate-600 mb-12 max-w-3xl mx-auto">
            Our AI-powered platform delivers measurable outcomes that transform your sales process
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-blue-900 mb-2">95%+</div>
                <h3 className="text-lg font-semibold text-blue-800 mb-1">Data Accuracy</h3>
                <p className="text-sm text-blue-700">
                  Verified across all data sources
                </p>
              </CardContent>
            </Card>

            <Card className="text-center bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-emerald-900 mb-2">50%+</div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-1">Time Saved</h3>
                <p className="text-sm text-emerald-700">
                  Reduction in manual research
                </p>
              </CardContent>
            </Card>

            <Card className="text-center bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-purple-900 mb-2">30%+</div>
                <h3 className="text-lg font-semibold text-purple-800 mb-1">Higher Conversion</h3>
                <p className="text-sm text-purple-700">
                  Improvement in lead conversion rates
                </p>
              </CardContent>
            </Card>

            <Card className="text-center bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-amber-900 mb-2">25%+</div>
                <h3 className="text-lg font-semibold text-amber-800 mb-1">Lower CAC</h3>
                <p className="text-sm text-amber-700">
                  Reduction in acquisition costs
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Everything you need to generate quality leads
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Smart Prospect Discovery</h3>
                <p className="text-slate-600">
                  Find high-quality prospects with advanced search filters and AI-powered recommendations.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Database className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Data Enrichment</h3>
                <p className="text-slate-600">
                  Enhance prospect profiles with verified contact information and company insights.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">AI Personalization</h3>
                <p className="text-slate-600">
                  Generate personalized messages that resonate with your prospects using advanced AI.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Campaign Management</h3>
                <p className="text-slate-600">
                  Launch and manage multi-channel outreach campaigns with automated follow-ups.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Advanced Analytics</h3>
                <p className="text-slate-600">
                  Track performance metrics and optimize your campaigns with detailed insights.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Guaranteed Results</h3>
                <p className="text-slate-600">
                  Performance-based pricing with data accuracy guarantees and proven ROI.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to transform your lead generation?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Join thousands of sales teams who trust LeadGen AI to grow their business.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => window.location.href = '/login'}
            className="text-lg px-8 py-3"
            data-testid="button-cta-bottom"
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-900 text-slate-400">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-white">LeadGen AI</span>
          </div>
          <p>&copy; 2024 LeadGen AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
