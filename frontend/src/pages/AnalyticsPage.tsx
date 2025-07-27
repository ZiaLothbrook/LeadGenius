import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Avatar,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Email,
  Phone,
  LinkedIn,
  Analytics,
  People,
  Campaign,
  OpenInNew,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { apiClient } from '../services/apiClient';

interface PerformanceMetrics {
  total_prospects: number;
  active_campaigns: number;
  messages_sent_today: number;
  messages_sent_week: number;
  messages_sent_month: number;
  avg_open_rate: number;
  avg_reply_rate: number;
  top_performing_campaigns: any[];
}

const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch performance metrics
  const { data: metrics, isLoading } = useQuery<PerformanceMetrics>({
    queryKey: ['analytics', 'performance'],
    queryFn: () => apiClient.get('/analytics/performance'),
  });

  // Mock data for charts - in production this would come from API
  const messageVolumeData = [
    { date: '2025-01-20', sent: 45, opened: 32, replied: 8 },
    { date: '2025-01-21', sent: 52, opened: 38, replied: 12 },
    { date: '2025-01-22', sent: 38, opened: 28, replied: 6 },
    { date: '2025-01-23', sent: 67, opened: 48, replied: 15 },
    { date: '2025-01-24', sent: 71, opened: 52, replied: 18 },
    { date: '2025-01-25', sent: 58, opened: 41, replied: 11 },
    { date: '2025-01-26', sent: 64, opened: 46, replied: 13 },
  ];

  const campaignTypeData = [
    { name: 'Email', value: 65, color: '#8884d8' },
    { name: 'LinkedIn', value: 25, color: '#82ca9d' },
    { name: 'Phone', value: 10, color: '#ffc658' },
  ];

  const industryPerformanceData = [
    { industry: 'Technology', open_rate: 28.5, reply_rate: 12.3 },
    { industry: 'Healthcare', open_rate: 31.2, reply_rate: 8.7 },
    { industry: 'Finance', open_rate: 22.8, reply_rate: 15.1 },
    { industry: 'Manufacturing', open_rate: 25.6, reply_rate: 9.4 },
    { industry: 'Retail', open_rate: 19.3, reply_rate: 6.8 },
  ];

  const MetricCard = ({ title, value, change, icon, color }: any) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            {change && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {change.startsWith('+') ? (
                  <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />
                ) : (
                  <TrendingDown sx={{ color: 'error.main', fontSize: 16 }} />
                )}
                <Typography variant="body2" sx={{ 
                  color: change.startsWith('+') ? 'success.main' : 'error.main', 
                  ml: 0.5 
                }}>
                  {change}
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
      <Box>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading analytics...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track performance and optimize your outreach campaigns
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            label="Time Range"
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Messages Sent (Week)"
            value={metrics?.messages_sent_week || 0}
            change="+12.5%"
            icon={<Email />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Open Rate"
            value={`${metrics?.avg_open_rate || 0}%`}
            change="+2.1%"
            icon={<OpenInNew />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Reply Rate"
            value={`${metrics?.avg_reply_rate || 0}%`}
            change="+1.8%"
            icon={<TrendingUp />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Campaigns"
            value={metrics?.active_campaigns || 0}
            change="+3"
            icon={<Campaign />}
            color="warning.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Message Volume Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Message Volume & Performance
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={messageVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="sent" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Sent"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="opened" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Opened"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="replied" 
                      stroke="#ffc658" 
                      strokeWidth={2}
                      name="Replied"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Campaign Type Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Campaign Types
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={campaignTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {campaignTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Industry Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Performance by Industry
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="industry" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="open_rate" fill="#8884d8" name="Open Rate %" />
                    <Bar dataKey="reply_rate" fill="#82ca9d" name="Reply Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Performing Campaigns */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Top Performing Campaigns
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Response Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(metrics?.top_performing_campaigns || []).slice(0, 5).map((campaign: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            Campaign {index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label="Email" size="small" />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2">
                              {(Math.random() * 15 + 5).toFixed(1)}%
                            </Typography>
                            <TrendingUp sx={{ ml: 1, fontSize: 16, color: 'success.main' }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;