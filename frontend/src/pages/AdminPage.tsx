import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Avatar,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard,
  People,
  Psychology,
  Storage,
  Refresh,
  Download,
  Warning,
  CheckCircle,
  Error,
  Block,
  Visibility,
  Delete,
  CloudDownload,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
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
} from 'recharts';

import { apiClient } from '../services/apiClient';

interface SystemStats {
  total_users: number;
  total_prospects: number;
  total_campaigns: number;
  total_messages: number;
  ai_requests_today: number;
  ai_requests_week: number;
  avg_response_time: number;
  error_rate: number;
  active_users_today: number;
}

interface UserActivity {
  user_id: string;
  username: string;
  email: string;
  prospects_count: number;
  campaigns_count: number;
  messages_sent: number;
  ai_requests: number;
  created_at: string;
}

interface PromptLog {
  id: string;
  user_id?: string;
  prompt_type: string;
  model_name: string;
  execution_time: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Fetch system stats
  const { data: systemStats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiClient.get('/admin/stats'),
  });

  // Fetch user activity
  const { data: userActivity = [], isLoading: usersLoading } = useQuery<UserActivity[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get('/admin/users'),
  });

  // Fetch prompt logs
  const { data: promptLogs = [], isLoading: logsLoading } = useQuery<PromptLog[]>({
    queryKey: ['admin', 'prompt-logs'],
    queryFn: () => apiClient.get('/admin/prompt-logs?limit=50'),
  });

  // Fetch system health
  const { data: systemHealth } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => apiClient.get('/admin/system-health'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch AI analytics
  const { data: aiAnalytics } = useQuery({
    queryKey: ['admin', 'ai-analytics'],
    queryFn: () => apiClient.get('/admin/prompt-analytics?days=7'),
  });

  // Disable user mutation
  const disableUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/admin/users/${userId}/disable`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      enqueueSnackbar('User disabled successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to disable user', { 
        variant: 'error' 
      });
    },
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: (table: string) => apiClient.get(`/admin/export/data?table=${table}`),
    onSuccess: (data) => {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.table}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Data exported successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to export data', { 
        variant: 'error' 
      });
    },
  });

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'unhealthy':
        return <Error color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color }: any) => (
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
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleUserAction = (user: UserActivity, action: string) => {
    setSelectedUser(user);
    if (action === 'disable') {
      disableUserMutation.mutate(user.user_id);
    } else if (action === 'view') {
      setOpenUserDialog(true);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            System monitoring and management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
        >
          Refresh
        </Button>
      </Box>

      {/* System Health Alert */}
      {systemHealth && Object.values(systemHealth).some((status: any) => status === 'unhealthy') && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Some system components are unhealthy. Check the system health section for details.
        </Alert>
      )}

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={systemStats?.total_users || 0}
            subtitle={`${systemStats?.active_users_today || 0} active today`}
            icon={<People />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="AI Requests (Week)"
            value={systemStats?.ai_requests_week || 0}
            subtitle={`${systemStats?.ai_requests_today || 0} today`}
            icon={<Psychology />}
            color="secondary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Response Time"
            value={`${systemStats?.avg_response_time || 0}s`}
            subtitle={`${systemStats?.error_rate || 0}% error rate`}
            icon={<Dashboard />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Data Points"
            value={((systemStats?.total_prospects || 0) + (systemStats?.total_campaigns || 0)).toLocaleString()}
            subtitle={`${systemStats?.total_messages || 0} messages sent`}
            icon={<Storage />}
            color="info.main"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="System Health" />
            <Tab label="User Management" />
            <Tab label="AI Monitoring" />
            <Tab label="Data Export" />
          </Tabs>
        </Box>

        {/* System Health Tab */}
        {currentTab === 0 && (
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              System Health Status
            </Typography>
            <Grid container spacing={2}>
              {systemHealth && Object.entries(systemHealth).map(([service, status]: [string, any]) => (
                <Grid item xs={12} sm={6} md={4} key={service}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                            {service.replace('_', ' ')}
                          </Typography>
                          <Chip
                            label={status}
                            color={getHealthStatusColor(status) as any}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                        {getHealthStatusIcon(status)}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* AI Analytics Chart */}
            {aiAnalytics && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  AI Usage Analytics (Last 7 Days)
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiAnalytics.daily_usage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="requests" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="errors" stroke="#ff7300" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}
          </CardContent>
        )}

        {/* User Management Tab */}
        {currentTab === 1 && (
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              User Activity
            </Typography>
            {usersLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Prospects</TableCell>
                      <TableCell>Campaigns</TableCell>
                      <TableCell>Messages</TableCell>
                      <TableCell>AI Requests</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userActivity.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {user.username}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{user.prospects_count}</TableCell>
                        <TableCell>{user.campaigns_count}</TableCell>
                        <TableCell>{user.messages_sent}</TableCell>
                        <TableCell>{user.ai_requests}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleUserAction(user, 'view')}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Disable User">
                            <IconButton
                              size="small"
                              onClick={() => handleUserAction(user, 'disable')}
                              color="error"
                            >
                              <Block />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        )}

        {/* AI Monitoring Tab */}
        {currentTab === 2 && (
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              AI Prompt Logs
            </Typography>
            {logsLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Execution Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>User</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {promptLogs.slice(0, 20).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Chip label={log.prompt_type} size="small" />
                        </TableCell>
                        <TableCell>{log.model_name}</TableCell>
                        <TableCell>{log.execution_time.toFixed(3)}s</TableCell>
                        <TableCell>
                          <Chip
                            label={log.success ? 'Success' : 'Error'}
                            color={log.success ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {log.user_id ? log.user_id.slice(0, 8) : 'System'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        )}

        {/* Data Export Tab */}
        {currentTab === 3 && (
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Export System Data
            </Typography>
            <Grid container spacing={2}>
              {['users', 'prospects', 'campaigns', 'messages', 'prompt_logs'].map((table) => (
                <Grid item xs={12} sm={6} md={4} key={table}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ textTransform: 'capitalize', mb: 2 }}>
                        {table.replace('_', ' ')}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<CloudDownload />}
                        fullWidth
                        onClick={() => exportDataMutation.mutate(table)}
                        disabled={exportDataMutation.isPending}
                      >
                        Export
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        )}
      </Card>

      {/* User Details Dialog */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  value={selectedUser.username}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  value={selectedUser.email}
                  disabled
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Prospects"
                  value={selectedUser.prospects_count}
                  disabled
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Campaigns"
                  value={selectedUser.campaigns_count}
                  disabled
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUserDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;