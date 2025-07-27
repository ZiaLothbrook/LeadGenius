import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Campaign,
  Analytics,
  Email,
  Phone,
  Business,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

interface DashboardStats {
  totalProspects: string;
  activeCampaigns: string;
  totalMessages: string;
  openRate: string;
}

const DashboardPage: React.FC = () => {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.get('/dashboard/stats'),
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => apiClient.get('/analytics/recent-activity'),
    enabled: false, // Mock data for now
  });

  const StatCard = ({ title, value, icon, color, trend }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />
                <Typography variant="body2" sx={{ color: 'success.main', ml: 0.5 }}>
                  {trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
        Dashboard
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome back! Here's what's happening with your lead generation campaigns.
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Prospects"
            value={stats?.totalProspects || '0'}
            icon={<People />}
            color="primary.main"
            trend="+12% this month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Campaigns"
            value={stats?.activeCampaigns || '0'}
            icon={<Campaign />}
            color="secondary.main"
            trend="+3 this week"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Messages Sent"
            value={stats?.totalMessages || '0'}
            icon={<Email />}
            color="success.main"
            trend="+24% this week"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Open Rate"
            value={stats?.openRate || '0%'}
            icon={<Analytics />}
            color="warning.main"
            trend="+2.1% vs last month"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activity */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Recent Activity
              </Typography>
              <List>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <People />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="New prospects discovered"
                    secondary="25 new prospects added from Apollo.io search"
                  />
                  <Chip label="5 min ago" size="small" />
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                      <Campaign />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Campaign launched"
                    secondary="Q1 Outreach campaign started with 150 prospects"
                  />
                  <Chip label="2 hours ago" size="small" />
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <Email />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Messages sent"
                    secondary="45 personalized emails delivered successfully"
                  />
                  <Chip label="4 hours ago" size="small" />
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <Business />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Data enrichment completed"
                    secondary="AI enrichment finished for 89 prospects"
                  />
                  <Chip label="6 hours ago" size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <People sx={{ mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="subtitle2">Discover Prospects</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Find new leads with AI
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Campaign sx={{ mr: 2, color: 'secondary.main' }} />
                      <Box>
                        <Typography variant="subtitle2">Create Campaign</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Launch new outreach
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Analytics sx={{ mr: 2, color: 'success.main' }} />
                      <Box>
                        <Typography variant="subtitle2">View Analytics</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Track performance
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;