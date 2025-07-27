import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Fab,
} from '@mui/material';
import {
  Search,
  Add,
  FilterList,
  MoreVert,
  Business,
  Email,
  Phone,
  LinkedIn,
  Edit,
  Delete,
  Star,
  StarBorder,
  Download,
  Upload,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { apiClient } from '../services/apiClient';
import { useProspectStore } from '../stores/prospectStore';

interface Prospect {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  industry: string;
  location: string;
  score: number;
  verified: boolean;
  data_source: string;
  created_at: string;
}

const ProspectsPage: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  
  const {
    prospects,
    selectedProspects,
    filters,
    setProspects,
    setSelectedProspects,
    toggleProspectSelection,
    setFilters,
    clearSelection,
  } = useProspectStore();

  // Fetch prospects
  const { data: prospectsData, isLoading, error } = useQuery<Prospect[]>({
    queryKey: ['prospects', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.industry) params.append('industry', filters.industry);
      if (filters.location) params.append('location', filters.location);
      if (filters.verified !== null) params.append('verified', filters.verified.toString());
      
      return apiClient.get(`/prospects?${params.toString()}`);
    },
  });

  // Delete prospect mutation
  const deleteMutation = useMutation({
    mutationFn: (prospectId: string) => apiClient.delete(`/prospects/${prospectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      enqueueSnackbar('Prospect deleted successfully', { variant: 'success' });
      setAnchorEl(null);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to delete prospect', { 
        variant: 'error' 
      });
    },
  });

  // Enrich prospect mutation
  const enrichMutation = useMutation({
    mutationFn: (prospectId: string) => apiClient.post(`/prospects/${prospectId}/enrich`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      enqueueSnackbar('Prospect enriched successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to enrich prospect', { 
        variant: 'error' 
      });
    },
  });

  React.useEffect(() => {
    if (prospectsData) {
      setProspects(prospectsData);
    }
  }, [prospectsData, setProspects]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, prospect: Prospect) => {
    setAnchorEl(event.currentTarget);
    setSelectedProspect(prospect);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProspect(null);
  };

  const handleDelete = () => {
    if (selectedProspect) {
      deleteMutation.mutate(selectedProspect.id);
    }
  };

  const handleEnrich = () => {
    if (selectedProspect) {
      enrichMutation.mutate(selectedProspect.id);
      handleMenuClose();
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    setFilters({ search: value });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getScoreIcon = (score: number) => {
    return score >= 70 ? <Star color="action" /> : <StarBorder color="action" />;
  };

  if (isLoading) {
    return (
      <Box>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading prospects...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="h6" color="error">
          Failed to load prospects
        </Typography>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['prospects'] })}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Prospects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and enrich your prospect database with AI-powered insights
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Upload />}>
            Import
          </Button>
          <Button variant="outlined" startIcon={<Download />}>
            Export
          </Button>
          <Button variant="contained" startIcon={<Add />}>
            Add Prospect
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search prospects..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                  size="small"
                >
                  Filters
                </Button>
                {selectedProspects.length > 0 && (
                  <Chip
                    label={`${selectedProspects.length} selected`}
                    onDelete={clearSelection}
                    color="primary"
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Prospects Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedProspects.length > 0 && selectedProspects.length < prospects.length}
                    checked={prospects.length > 0 && selectedProspects.length === prospects.length}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedProspects(prospects.map(p => p.id));
                      } else {
                        clearSelection();
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Prospect</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Industry</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prospects.map((prospect) => (
                <TableRow
                  key={prospect.id}
                  hover
                  selected={selectedProspects.includes(prospect.id)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedProspects.includes(prospect.id)}
                      onChange={() => toggleProspectSelection(prospect.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {prospect.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {prospect.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {prospect.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          {prospect.email && (
                            <IconButton size="small" color="primary">
                              <Email fontSize="small" />
                            </IconButton>
                          )}
                          {prospect.phone && (
                            <IconButton size="small" color="primary">
                              <Phone fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton size="small" color="primary">
                            <LinkedIn fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Business sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="subtitle2">
                          {prospect.company}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {prospect.location}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={prospect.industry} size="small" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getScoreIcon(prospect.score)}
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="subtitle2">
                          {prospect.score}/100
                        </Typography>
                        <Chip
                          label={prospect.verified ? 'Verified' : 'Unverified'}
                          size="small"
                          color={prospect.verified ? 'success' : 'default'}
                        />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={prospect.data_source}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={(event) => handleMenuOpen(event, prospect)}
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
        <MenuItem onClick={handleEnrich}>
          <Star sx={{ mr: 1 }} />
          Enrich with AI
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Edit sx={{ mr: 1 }} />
          Edit
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

export default ProspectsPage;