import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Fab,
} from '@mui/material';
import {
  Add,
  PlayArrow,
  Pause,
  Stop,
  MoreVert,
  Email,
  LinkedIn,
  Phone,
  Analytics,
  People,
  TrendingUp,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { apiClient } from '../services/apiClient';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  subject?: string;
  message_template: string;
  goal: string;
  tone: string;
  total_prospects: number;
  sent_count: number;
  response_count: number;
  created_at: string;
  updated_at: string;
}

const CampaignsPage: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => apiClient.get('/campaigns'),
  });

  // Launch campaign mutation
  const launchMutation = useMutation({
    mutationFn: (campaignId: string) => apiClient.post(`/campaigns/${campaignId}/launch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      enqueueSnackbar('Campaign launched successfully!', { variant: 'success' });
      setAnchorEl(null);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to launch campaign', { 
        variant: 'error' 
      });
    },
  });

  // Pause campaign mutation
  const pauseMutation = useMutation({
    mutationFn: (campaignId: string) => apiClient.post(`/campaigns/${campaignId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      enqueueSnackbar('Campaign paused successfully!', { variant: 'success' });
      setAnchorEl(null);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to pause campaign', { 
        variant: 'error' 
      });
    },
  });

  // Delete campaign mutation
  const deleteMutation = useMutation({
    mutationFn: (campaignId: string) => apiClient.delete(`/campaigns/${campaignId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      enqueueSnackbar('Campaign deleted successfully!', { variant: 'success' });
      setAnchorEl(null);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to delete campaign', { 
        variant: 'error' 
      });
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, campaign: Campaign) => {
    setAnchorEl(event.currentTarget);
    setSelectedCampaign(campaign);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCampaign(null);
  };

  const handleLaunch = () => {
    if (selectedCampaign) {
      launchMutation.mutate(selectedCampaign.id);
    }
  };

  const handlePause = () => {
    if (selectedCampaign) {
      pauseMutation.mutate(selectedCampaign.id);
    }
  };

  const handleDelete = () => {
    if (selectedCampaign) {
      deleteMutation.mutate(selectedCampaign.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'info';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Email />;
      case 'linkedin':
        return <LinkedIn />;
      case 'phone':
        return <Phone />;
      default:
        return <Email />;
    }
  };

  const calculateResponseRate = (campaign: Campaign) => {
    if (campaign.sent_count === 0) return 0;
    return ((campaign.response_count / campaign.sent_count) * 100).toFixed(1);
  };

  if (isLoading) {
    return (
      <Box>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading campaigns...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Campaigns
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your outreach campaigns and track performance
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />}>
          Create Campaign
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Campaigns
                  </Typography>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
                    {campaigns.length}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <Analytics />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Campaigns
                  </Typography>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
                    {campaigns.filter(c => c.status === 'active').length}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <PlayArrow />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Messages Sent
                  </Typography>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
                    {campaigns.reduce((sum, c) => sum + c.sent_count, 0)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                  <Email />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg Response Rate
                  </Typography>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
                    {campaigns.length > 0 
                      ? (campaigns.reduce((sum, c) => sum + parseFloat(calculateResponseRate(c)), 0) / campaigns.length).toFixed(1)
                      : '0'
                    }%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Campaigns Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campaign</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Prospects</TableCell>
                <TableCell>Sent</TableCell>
                <TableCell>Response Rate</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {campaign.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {campaign.goal}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getTypeIcon(campaign.type)}
                      <Typography sx={{ ml: 1, textTransform: 'capitalize' }}>
                        {campaign.type}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={campaign.status}
                      color={getStatusColor(campaign.status) as any}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <People sx={{ mr: 1, fontSize: 16 }} />
                      {campaign.total_prospects}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {campaign.sent_count} / {campaign.total_prospects}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(campaign.sent_count / campaign.total_prospects) * 100}
                      sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUp sx={{ mr: 1, fontSize: 16, color: 'success.main' }} />
                      {calculateResponseRate(campaign)}%
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={(event) => handleMenuOpen(event, campaign)}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedCampaign?.status === 'draft' && (
          <MenuItem onClick={handleLaunch}>
            <PlayArrow sx={{ mr: 1 }} />
            Launch
          </MenuItem>
        )}
        {selectedCampaign?.status === 'active' && (
          <MenuItem onClick={handlePause}>
            <Pause sx={{ mr: 1 }} />
            Pause
          </MenuItem>
        )}
        <MenuItem onClick={handleMenuClose}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Analytics sx={{ mr: 1 }} />
          View Analytics
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setOpenDialog(true)}
      >
        <Add />
      </Fab>
    </Box>
  );
};

export default CampaignsPage;