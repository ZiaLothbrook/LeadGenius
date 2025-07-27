import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Play, Pause, Settings, AlertTriangle, TrendingUp, Users, MessageSquare, Activity } from 'lucide-react';

interface Schedule {
  id: string;
  scheduleName: string;
  scheduleType: 'immediate' | 'scheduled' | 'recurring' | 'optimal';
  timezone: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  totalScheduled: number;
  totalSent: number;
  nextSendAt: string | null;
  priority: number;
  createdAt: string;
}

interface DashboardData {
  activeSchedules: number;
  pendingMessages: number;
  sentToday: number;
  activeConflicts: number;
  schedules: Schedule[];
  upcomingMessages: any[];
  optimizationStats: {
    totalOptimizations: number;
    averageConfidence: number;
    improvementPotential: string;
  };
}

interface Timezone {
  value: string;
  label: string;
  offset: string;
}

export default function CampaignScheduling() {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    campaignId: '',
    scheduleName: '',
    scheduleType: 'scheduled' as const,
    timezone: 'UTC',
    scheduledAt: '',
    recurringPattern: 'daily' as const,
    sendWindowStart: '09:00',
    sendWindowEnd: '17:00',
    allowWeekends: false,
    enableOptimalTiming: true,
    optimizationGoal: 'open_rate' as const,
    priority: 5,
    conflictResolution: 'queue' as const,
    maxDailyMessages: 100,
    minMessageInterval: 60,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/campaign-scheduling/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch timezones
  const { data: timezonesResponse } = useQuery({
    queryKey: ['/api/campaign-scheduling/timezones'],
  });

  // Fetch user campaigns for selection
  const { data: campaigns } = useQuery({
    queryKey: ['/api/campaigns'],
  });

  // Create schedule mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/campaign-scheduling/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create schedule');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Schedule Created',
        description: 'Campaign schedule created successfully',
      });
      setShowCreateDialog(false);
      setFormData({
        ...formData,
        campaignId: '',
        scheduleName: '',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-scheduling/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create schedule',
        variant: 'destructive',
      });
    },
  });

  // Toggle schedule status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, status }: { scheduleId: string; status: string }) => {
      const response = await fetch(`/api/campaign-scheduling/schedules/${scheduleId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Status Updated',
        description: 'Schedule status updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-scheduling/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  // Calculate optimal timing mutation
  const calculateOptimalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/campaign-scheduling/optimal-timing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to calculate optimal timing');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Optimal Timing Calculated',
        description: `Best send time: ${new Date(data.optimalSendTime).toLocaleString()}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to calculate optimal timing',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSchedule = () => {
    if (!formData.campaignId || !formData.scheduleName) {
      toast({
        title: 'Validation Error',
        description: 'Please select a campaign and enter a schedule name',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const handleToggleStatus = (scheduleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    toggleStatusMutation.mutate({ scheduleId, status: newStatus });
  };

  const handleCalculateOptimal = () => {
    calculateOptimalMutation.mutate({
      timezone: formData.timezone,
      optimizationGoal: formData.optimizationGoal,
    });
  };

  const timezones: Timezone[] = timezonesResponse?.timezones || [];
  const dashboardData: DashboardData = dashboard as DashboardData || {
    activeSchedules: 0,
    pendingMessages: 0,
    sentToday: 0,
    activeConflicts: 0,
    schedules: [],
    upcomingMessages: [],
    optimizationStats: {
      totalOptimizations: 0,
      averageConfidence: 0,
      improvementPotential: '0%',
    },
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6" data-testid="campaign-scheduling-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Campaign Scheduling</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Intelligent timezone-aware scheduling with optimal timing algorithms
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-schedule">
              <Calendar className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Campaign Schedule</DialogTitle>
              <DialogDescription>
                Set up intelligent scheduling with timezone awareness and optimization
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Select
                  value={formData.campaignId}
                  onValueChange={(value) => setFormData({ ...formData, campaignId: value })}
                >
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaigns as any[])?.map((campaign: any) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleName">Schedule Name</Label>
                <Input
                  data-testid="input-schedule-name"
                  value={formData.scheduleName}
                  onChange={(e) => setFormData({ ...formData, scheduleName: e.target.value })}
                  placeholder="Enter schedule name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleType">Schedule Type</Label>
                <Select
                  value={formData.scheduleType}
                  onValueChange={(value: any) => setFormData({ ...formData, scheduleType: value })}
                >
                  <SelectTrigger data-testid="select-schedule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Send Immediately</SelectItem>
                    <SelectItem value="scheduled">Scheduled Time</SelectItem>
                    <SelectItem value="recurring">Recurring Schedule</SelectItem>
                    <SelectItem value="optimal">AI-Optimized Timing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label} ({tz.offset})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.scheduleType === 'scheduled' && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Scheduled Time</Label>
                  <Input
                    data-testid="input-scheduled-time"
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="sendWindowStart">Send Window Start</Label>
                <Input
                  data-testid="input-send-window-start"
                  type="time"
                  value={formData.sendWindowStart}
                  onChange={(e) => setFormData({ ...formData, sendWindowStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sendWindowEnd">Send Window End</Label>
                <Input
                  data-testid="input-send-window-end"
                  type="time"
                  value={formData.sendWindowEnd}
                  onChange={(e) => setFormData({ ...formData, sendWindowEnd: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDailyMessages">Max Daily Messages</Label>
                <Input
                  data-testid="input-max-daily-messages"
                  type="number"
                  value={formData.maxDailyMessages}
                  onChange={(e) => setFormData({ ...formData, maxDailyMessages: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  data-testid="switch-allow-weekends"
                  checked={formData.allowWeekends}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowWeekends: checked })}
                />
                <Label>Allow Weekend Sending</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  data-testid="switch-enable-optimal-timing"
                  checked={formData.enableOptimalTiming}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableOptimalTiming: checked })}
                />
                <Label>Enable AI Optimization</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleCreateSchedule}
                disabled={createMutation.isPending}
                data-testid="button-submit-schedule"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCalculateOptimal}
                disabled={calculateOptimalMutation.isPending}
                data-testid="button-calculate-optimal"
              >
                {calculateOptimalMutation.isPending ? 'Calculating...' : 'Calculate Optimal Time'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">Active Schedules</TabsTrigger>
          <TabsTrigger value="optimization" data-testid="tab-optimization">AI Optimization</TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">Conflict Resolution</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card data-testid="card-active-schedules">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Schedules</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardData.activeSchedules}</p>
                    </div>
                    <Activity className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-pending-messages">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Messages</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardData.pendingMessages}</p>
                    </div>
                    <MessageSquare className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-sent-today">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent Today</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardData.sentToday}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-active-conflicts">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Conflicts</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardData.activeConflicts}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Messages</CardTitle>
                <CardDescription>Next scheduled sends across all campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.upcomingMessages.length > 0 ? (
                    dashboardData.upcomingMessages.map((message: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{message.scheduleName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(message.scheduledAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline">{message.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No upcoming messages</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Optimization Stats</CardTitle>
                <CardDescription>Performance insights from AI-powered timing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Optimizations</span>
                  <span className="font-medium">{dashboardData.optimizationStats.totalOptimizations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Average Confidence</span>
                  <span className="font-medium">{dashboardData.optimizationStats.averageConfidence}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Improvement Potential</span>
                  <Badge variant="secondary">{dashboardData.optimizationStats.improvementPotential}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          <div className="grid gap-4">
            {dashboardData.schedules.length > 0 ? (
              dashboardData.schedules.map((schedule: Schedule) => (
                <Card key={schedule.id} data-testid={`schedule-card-${schedule.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{schedule.scheduleName}</h3>
                          <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'}>
                            {schedule.status}
                          </Badge>
                          <Badge variant="outline">{schedule.scheduleType}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">Timezone:</span> {schedule.timezone}
                          </div>
                          <div>
                            <span className="font-medium">Scheduled:</span> {schedule.totalScheduled}
                          </div>
                          <div>
                            <span className="font-medium">Sent:</span> {schedule.totalSent}
                          </div>
                          <div>
                            <span className="font-medium">Priority:</span> {schedule.priority}/10
                          </div>
                        </div>
                        {schedule.nextSendAt && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Next Send:</span>{' '}
                            {new Date(schedule.nextSendAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(schedule.id, schedule.status)}
                          disabled={toggleStatusMutation.isPending}
                          data-testid={`button-toggle-${schedule.id}`}
                        >
                          {schedule.status === 'active' ? (
                            <>
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </>
                          )}
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`button-settings-${schedule.id}`}>
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Schedules</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Create your first campaign schedule to get started with intelligent timing
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-schedule">
                    Create Your First Schedule
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Timing Optimization</CardTitle>
              <CardDescription>
                Intelligent send time optimization using machine learning and recipient behavior analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Optimal Hour Analysis</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    AI analyzes recipient engagement patterns to identify the best sending hours
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Timezone Intelligence</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatic timezone detection and localized send time optimization
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Behavioral Learning</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Continuous learning from campaign performance to improve timing
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCalculateOptimal}
                  disabled={calculateOptimalMutation.isPending}
                  data-testid="button-run-optimization"
                >
                  {calculateOptimalMutation.isPending ? 'Analyzing...' : 'Run AI Optimization'}
                </Button>
                <Button variant="outline" data-testid="button-view-insights">
                  View Insights
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Conflict Resolution</CardTitle>
              <CardDescription>
                Intelligent conflict detection and automated resolution for overlapping schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.activeConflicts > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                      <h4 className="font-medium">Active Conflicts Detected</h4>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {dashboardData.activeConflicts} scheduling conflicts require attention
                    </p>
                  </div>
                  <Button data-testid="button-resolve-conflicts">Resolve All Conflicts</Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Conflicts Detected</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    All schedules are optimally arranged without conflicts
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}