import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  Search,
  FilterList,
  HowToVote,
  Schedule,
  People,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useVoting } from '../contexts/VotingContext';

const Elections: React.FC = () => {
  const navigate = useNavigate();
  const { election, isRegistered, isLoading } = useVoting();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mock multiple elections for elections page display
  const mockElections = [
    {
      id: '1',
      name: '2024 General Election',
      description: 'National General Election with Blockchain Security',
      state: 'Voting',
      startTime: Date.now() - 86400000, // Started 1 day ago
      endTime: Date.now() + 86400000, // Ends in 1 day
      registeredVoters: 1250000,
      totalVotes: 875000,
      candidates: ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson']
    },
    {
      id: '2', 
      name: 'Local Council Election',
      description: 'Municipal Council Election for District 5',
      state: 'Registration',
      startTime: Date.now() + 604800000, // Starts in 1 week
      endTime: Date.now() + 1209600000, // Ends in 2 weeks
      registeredVoters: 45000,
      totalVotes: 0,
      candidates: ['Emma Brown', 'Frank Miller', 'Grace Lee']
    },
    {
      id: '3',
      name: 'School Board Election',
      description: 'Annual School Board Member Selection',
      state: 'Completed',
      startTime: Date.now() - 2592000000, // Started 1 month ago
      endTime: Date.now() - 1987200000, // Ended 3 weeks ago
      registeredVoters: 25000,
      totalVotes: 18500,
      candidates: ['Helen Garcia', 'Ivan Rodriguez', 'Julia Martinez']
    },
    {
      id: '4',
      name: 'State Governor Election',
      description: 'State-wide Governor Election',
      state: 'Setup',
      startTime: Date.now() + 2592000000, // Starts in 1 month
      endTime: Date.now() + 3196800000, // Ends in 37 days
      registeredVoters: 0,
      totalVotes: 0,
      candidates: ['Kevin Thompson', 'Linda Anderson']
    }
  ];

  const filteredElections = mockElections.filter((election) => {
    const matchesSearch = election.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         election.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || election.state.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'Setup':
        return 'default';
      case 'Registration':
        return 'info';
      case 'Voting':
        return 'success';
      case 'Tallying':
        return 'warning';
      case 'Completed':
        return 'success';
      case 'Cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m remaining`;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Elections
      </Typography>

      {/* Search and Filter */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search elections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
            startAdornment={<FilterList sx={{ mr: 1 }} />}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="setup">Setup</MenuItem>
            <MenuItem value="registration">Registration</MenuItem>
            <MenuItem value="voting">Voting</MenuItem>
            <MenuItem value="tallying">Tallying</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Elections Grid */}
      <Grid container spacing={3}>
        {filteredElections.map((election) => (
          <Grid item xs={12} md={6} lg={4} key={election.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" component="h2" noWrap>
                    {election.name}
                  </Typography>
                  <Chip
                    label={election.state}
                    color={getStatusColor(election.state) as any}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  {election.description}
                </Typography>
                
                {/* Election Stats */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {election.registeredVoters}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <HowToVote fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {election.totalVotes}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Timing Information */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <Schedule fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {election.state === 'Voting' || election.state === 'Registration' 
                      ? getTimeRemaining(election.endTime)
                      : `Ended ${new Date(election.endTime).toLocaleDateString()}`
                    }
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  {new Date(election.startTime).toLocaleDateString()} - {new Date(election.endTime).toLocaleDateString()}
                </Typography>
                
                {/* Candidates Preview */}
                {election.candidates.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Candidates: {election.candidates.slice(0, 3).join(', ')}
                      {election.candidates.length > 3 && ` +${election.candidates.length - 3} more`}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button
                  size="small"
                  onClick={() => navigate(`/elections/${election.id}`)}
                >
                  View Details
                </Button>
                
                {election.state === 'Registration' && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/register?election=${election.id}`)}
                  >
                    Register
                  </Button>
                )}
                
                {election.state === 'Voting' && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => navigate(`/vote/${election.id}`)}
                  >
                    Vote
                  </Button>
                )}
                
                {election.state === 'Completed' && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/results/${election.id}`)}
                  >
                    Results
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredElections.length === 0 && !isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm || statusFilter !== 'all' 
              ? 'No elections match your search criteria'
              : 'No elections available'
            }
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter settings'
              : 'Check back later for new elections'
            }
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Elections;
