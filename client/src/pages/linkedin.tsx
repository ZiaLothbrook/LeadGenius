import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Box,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  LinkedIn,
  Warning,
  CheckCircle,
  Message,
  People,
  Analytics,
  Info,
  ExpandMore,
  Send,
  ContentCopy,
  Schedule
} from '@mui/icons-material';

interface LinkedInMessage {
  id: string;
  status: 'prepared' | 'manual_send_required';
  to: string;
  content: string;
  formattedContent: string;
  characterCount: number;
  complianceCheck: {
    isCompliant: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    issues: Array<{
      type: string;
      severity: 'warning' | 'error';
      message: string;
      suggestion: string;
    }>;
    recommendations: string[];
  };
  sendingGuidance: {
    bestTimeToSend: string;
    personalizedElements: string[];
    complianceTips: string[];
    rateLimitingAdvice: string;
    followUpStrategy: string;
  };
  createdAt: Date;
}

interface RateLimits {
  connectionRequests: {
    weekly: number;
    current: number;
    resetDate: Date;
  };
  messages: {
    daily: number;
    current: number;
    resetDate: Date;
  };
  profileViews: {
    daily: number;
    current: number;
    resetDate: Date;
  };
}

interface ComplianceGuidelines {
  rateLimits: Record<string, string>;
  bestPractices: string[];
  prohibitedActions: string[];
  recommendations: string[];
}

export default function LinkedInPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProspect, setSelectedProspect] = useState('');
  const [campaignContext, setCampaignContext] = useState({
    productName: '',
    valueProposition: '',
    callToAction: ''
  });
  const [generatedMessage, setGeneratedMessage] = useState<LinkedInMessage | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [interactionData, setInteractionData] = useState({
    campaignId: '',
    prospectId: '',
    interactionType: 'connection_sent' as const,
    notes: ''
  });

  const queryClient = useQueryClient();

  // Fetch prospects
  const { data: prospects = [] } = useQuery({
    queryKey: ['/api/prospects'],
    select: (data: any[]) => data.filter(p => p.linkedinUrl || p.name)
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['/api/campaigns']
  });

  // Fetch rate limits
  const { data: rateLimits } = useQuery<RateLimits>({
    queryKey: ['/api/linkedin/rate-limits']
  });

  // Fetch compliance guidelines
  const { data: guidelines } = useQuery<ComplianceGuidelines>({
    queryKey: ['/api/linkedin/compliance']
  });

  // Generate connection request mutation
  const connectionRequestMutation = useMutation({
    mutationFn: async (data: { prospectId: string; campaignContext: any }) => {
      const response = await fetch('/api/linkedin/connection-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to generate connection request');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedMessage(data);
      setShowMessageDialog(true);
    }
  });

  // Generate follow-up mutation
  const followUpMutation = useMutation({
    mutationFn: async (data: { prospectId: string; campaignContext: any; previousInteraction?: string }) => {
      const response = await fetch('/api/linkedin/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to generate follow-up message');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedMessage(data);
      setShowMessageDialog(true);
    }
  });

  // Record interaction mutation
  const recordInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/linkedin/record-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to record interaction');
      return response.json();
    },
    onSuccess: () => {
      setInteractionDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/rate-limits'] });
    }
  });

  const handleGenerateConnectionRequest = () => {
    if (!selectedProspect) {
      alert('Please select a prospect');
      return;
    }

    connectionRequestMutation.mutate({
      prospectId: selectedProspect,
      campaignContext
    });
  };

  const handleGenerateFollowUp = () => {
    if (!selectedProspect) {
      alert('Please select a prospect');
      return;
    }

    followUpMutation.mutate({
      prospectId: selectedProspect,
      campaignContext,
      previousInteraction: 'Connection accepted'
    });
  };

  const handleRecordInteraction = () => {
    recordInteractionMutation.mutate({
      campaignId: interactionData.campaignId,
      interaction: {
        prospectId: interactionData.prospectId,
        interactionType: interactionData.interactionType,
        notes: interactionData.notes,
        timestamp: new Date()
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'info';
    }
  };

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <LinkedIn sx={{ fontSize: 40, color: '#0077B5', mr: 2 }} />
        <Typography variant="h3" component="h1" fontWeight="bold">
          LinkedIn Messaging
        </Typography>
      </Box>

      <Alert severity="info" icon={<Info />} sx={{ mb: 4 }}>
        <Typography variant="body2">
          <strong>Compliance Notice:</strong> This system generates LinkedIn-optimized messages for manual sending. 
          Automated LinkedIn messaging violates their Terms of Service and can result in account restrictions.
        </Typography>
      </Alert>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
        <Tab label="Message Generator" icon={<Message />} />
        <Tab label="Rate Limits" icon={<Analytics />} />
        <Tab label="Compliance Guide" icon={<Warning />} />
        <Tab label="Track Interactions" icon={<People />} />
      </Tabs>

      {/* Message Generator Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Generate LinkedIn Messages
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Prospect</InputLabel>
                  <Select
                    value={selectedProspect}
                    onChange={(e) => setSelectedProspect(e.target.value)}
                    data-testid="select-prospect"
                  >
                    {prospects.map((prospect: any) => (
                      <MenuItem key={prospect.id} value={prospect.id}>
                        {prospect.name} - {prospect.company}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Product/Service Name"
                  value={campaignContext.productName}
                  onChange={(e) => setCampaignContext(prev => ({
                    ...prev,
                    productName: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                  data-testid="input-product-name"
                />

                <TextField
                  fullWidth
                  label="Value Proposition"
                  multiline
                  rows={3}
                  value={campaignContext.valueProposition}
                  onChange={(e) => setCampaignContext(prev => ({
                    ...prev,
                    valueProposition: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                  data-testid="input-value-prop"
                />

                <TextField
                  fullWidth
                  label="Call to Action"
                  value={campaignContext.callToAction}
                  onChange={(e) => setCampaignContext(prev => ({
                    ...prev,
                    callToAction: e.target.value
                  }))}
                  sx={{ mb: 3 }}
                  data-testid="input-cta"
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleGenerateConnectionRequest}
                    disabled={connectionRequestMutation.isPending}
                    startIcon={<People />}
                    data-testid="button-generate-connection"
                  >
                    Generate Connection Request
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={handleGenerateFollowUp}
                    disabled={followUpMutation.isPending}
                    startIcon={<Message />}
                    data-testid="button-generate-followup"
                  >
                    Generate Follow-up
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Rate Limits
                </Typography>
                
                {rateLimits && (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Connection Requests (Weekly)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getUsagePercentage(rateLimits.connectionRequests.current, rateLimits.connectionRequests.weekly)}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption">
                        {rateLimits.connectionRequests.current} / {rateLimits.connectionRequests.weekly}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Messages (Daily)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getUsagePercentage(rateLimits.messages.current, rateLimits.messages.daily)}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption">
                        {rateLimits.messages.current} / {rateLimits.messages.daily}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Profile Views (Daily)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getUsagePercentage(rateLimits.profileViews.current, rateLimits.profileViews.daily)}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption">
                        {rateLimits.profileViews.current} / {rateLimits.profileViews.daily}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Rate Limits Tab */}
      {activeTab === 1 && rateLimits && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Connection Requests
                </Typography>
                <Typography variant="h4">{rateLimits.connectionRequests.current}</Typography>
                <Typography variant="body2" color="text.secondary">
                  of {rateLimits.connectionRequests.weekly} weekly limit
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={getUsagePercentage(rateLimits.connectionRequests.current, rateLimits.connectionRequests.weekly)}
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Resets: {new Date(rateLimits.connectionRequests.resetDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Messages
                </Typography>
                <Typography variant="h4">{rateLimits.messages.current}</Typography>
                <Typography variant="body2" color="text.secondary">
                  of {rateLimits.messages.daily} daily limit
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={getUsagePercentage(rateLimits.messages.current, rateLimits.messages.daily)}
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Resets: {new Date(rateLimits.messages.resetDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Profile Views
                </Typography>
                <Typography variant="h4">{rateLimits.profileViews.current}</Typography>
                <Typography variant="body2" color="text.secondary">
                  of {rateLimits.profileViews.daily} daily limit
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={getUsagePercentage(rateLimits.profileViews.current, rateLimits.profileViews.daily)}
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Resets: {new Date(rateLimits.profileViews.resetDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Compliance Guide Tab */}
      {activeTab === 2 && guidelines && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="success.main">
                  Best Practices
                </Typography>
                <List>
                  {guidelines.bestPractices.map((practice, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary={practice} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error.main">
                  Prohibited Actions
                </Typography>
                <List>
                  {guidelines.prohibitedActions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Warning color="error" />
                      </ListItemIcon>
                      <ListItemText primary={action} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Rate Limits & Guidelines
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Activity</TableCell>
                        <TableCell>Limit</TableCell>
                        <TableCell>Reset Period</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(guidelines.rateLimits).map(([activity, limit]) => (
                        <TableRow key={activity}>
                          <TableCell>{activity}</TableCell>
                          <TableCell>{limit}</TableCell>
                          <TableCell>
                            {activity.includes('week') ? 'Weekly' : 'Daily'}
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
      )}

      {/* Track Interactions Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Record LinkedIn Interactions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Manually track your LinkedIn interactions to maintain accurate campaign metrics.
                </Typography>
                
                <Button
                  variant="contained"
                  onClick={() => setInteractionDialog(true)}
                  startIcon={<People />}
                  data-testid="button-record-interaction"
                >
                  Record New Interaction
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Message Dialog */}
      <Dialog 
        open={showMessageDialog} 
        onClose={() => setShowMessageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Generated LinkedIn Message
        </DialogTitle>
        <DialogContent>
          {generatedMessage && (
            <Box>
              <Alert 
                severity={getRiskColor(generatedMessage.complianceCheck.riskLevel) as any}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">
                  <strong>Compliance Status:</strong> {generatedMessage.complianceCheck.isCompliant ? 'Compliant' : 'Issues Detected'}
                  <br />
                  <strong>Risk Level:</strong> {generatedMessage.complianceCheck.riskLevel.toUpperCase()}
                  <br />
                  <strong>Character Count:</strong> {generatedMessage.characterCount}
                </Typography>
              </Alert>

              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {generatedMessage.formattedContent}
                </Typography>
              </Paper>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>Sending Guidance</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    <strong>Best Time to Send:</strong> {generatedMessage.sendingGuidance.bestTimeToSend}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Personalized Elements:</strong> {generatedMessage.sendingGuidance.personalizedElements.join(', ') || 'None detected'}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Follow-up Strategy:</strong> {generatedMessage.sendingGuidance.followUpStrategy}
                  </Typography>
                </AccordionDetails>
              </Accordion>

              {generatedMessage.complianceCheck.issues.length > 0 && (
                <Accordion sx={{ mt: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography color="error">Compliance Issues ({generatedMessage.complianceCheck.issues.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {generatedMessage.complianceCheck.issues.map((issue, index) => (
                      <Alert key={index} severity={issue.severity === 'error' ? 'error' : 'warning'} sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>{issue.message}</strong>
                          <br />
                          {issue.suggestion}
                        </Typography>
                      </Alert>
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => generatedMessage && copyToClipboard(generatedMessage.formattedContent)}
            startIcon={<ContentCopy />}
            data-testid="button-copy-message"
          >
            Copy Message
          </Button>
          <Button onClick={() => setShowMessageDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Interaction Recording Dialog */}
      <Dialog 
        open={interactionDialog} 
        onClose={() => setInteractionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record LinkedIn Interaction</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Campaign</InputLabel>
            <Select
              value={interactionData.campaignId}
              onChange={(e) => setInteractionData(prev => ({
                ...prev,
                campaignId: e.target.value
              }))}
            >
              {campaigns.map((campaign: any) => (
                <MenuItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Prospect</InputLabel>
            <Select
              value={interactionData.prospectId}
              onChange={(e) => setInteractionData(prev => ({
                ...prev,
                prospectId: e.target.value
              }))}
            >
              {prospects.map((prospect: any) => (
                <MenuItem key={prospect.id} value={prospect.id}>
                  {prospect.name} - {prospect.company}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Interaction Type</InputLabel>
            <Select
              value={interactionData.interactionType}
              onChange={(e) => setInteractionData(prev => ({
                ...prev,
                interactionType: e.target.value as any
              }))}
            >
              <MenuItem value="connection_sent">Connection Request Sent</MenuItem>
              <MenuItem value="connection_accepted">Connection Accepted</MenuItem>
              <MenuItem value="message_sent">Message Sent</MenuItem>
              <MenuItem value="reply_received">Reply Received</MenuItem>
              <MenuItem value="meeting_scheduled">Meeting Scheduled</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Notes (Optional)"
            multiline
            rows={3}
            value={interactionData.notes}
            onChange={(e) => setInteractionData(prev => ({
              ...prev,
              notes: e.target.value
            }))}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInteractionDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRecordInteraction}
            variant="contained"
            disabled={recordInteractionMutation.isPending}
          >
            Record Interaction
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}