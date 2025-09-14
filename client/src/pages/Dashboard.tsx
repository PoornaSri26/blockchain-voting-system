import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Container,
} from '@mui/material';
import {
  HowToVote,
  Security,
  Verified,
  Timeline,
  AccountBalanceWallet,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { useVoting } from '../contexts/VotingContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, connectWallet } = useWeb3();
  const { election, isRegistered, isLoading } = useVoting();

  // Mock multiple elections for dashboard display
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
    }
  ];

  const activeElections = mockElections.filter(
    election => election.state === 'Voting' || election.state === 'Registration'
  );

  const upcomingElections = mockElections.filter(
    election => election.state === 'Setup'
  );

  const completedElections = mockElections.filter(
    election => election.state === 'Completed'
  );

  if (!isConnected) {
    return (
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <HowToVote sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            Blockchain Voting System
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Secure, transparent, and privacy-preserving digital elections
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 4, mb: 6 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 2 }}>
                <Security sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Zero-Knowledge Privacy
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vote anonymously with cryptographic proofs that protect your identity
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 2 }}>
                <Verified sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Verifiable Results
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Every vote is recorded on the blockchain for complete transparency
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 2 }}>
                <Timeline sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Immutable Records
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Election results cannot be tampered with or altered
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            size="large"
            startIcon={<AccountBalanceWallet />}
            onClick={connectWallet}
            sx={{ px: 4, py: 1.5 }}
          >
            Connect Wallet to Get Started
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {!isRegistered && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You need to create your voter identity before participating in elections.{' '}
          <Button
            color="inherit"
            onClick={() => navigate('/identity')}
            sx={{ textDecoration: 'underline' }}
          >
            Create Identity
          </Button>
        </Alert>
      )}

      {isLoading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Active Elections */}
      {activeElections.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Active Elections
          </Typography>
          <Grid container spacing={3}>
            {activeElections.map((election) => (
              <Grid item xs={12} md={6} lg={4} key={election.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" component="h2">
                        {election.name}
                      </Typography>
                      <Chip
                        label={election.state}
                        color={election.state === 'Voting' ? 'success' : 'primary'}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {election.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Registered Voters: {election.registeredVoters}
                      </Typography>
                      <Typography variant="body2">
                        Total Votes: {election.totalVotes}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      Ends: {new Date(election.endTime).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => navigate(`/elections/${election.id}`)}
                    >
                      View Details
                    </Button>
                    {election.state === 'Voting' && isRegistered && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/vote/${election.id}`)}
                      >
                        Vote Now
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Upcoming Elections */}
      {upcomingElections.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Upcoming Elections
          </Typography>
          <Grid container spacing={3}>
            {upcomingElections.map((election) => (
              <Grid item xs={12} md={6} lg={4} key={election.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" component="h2">
                        {election.name}
                      </Typography>
                      <Chip label="Upcoming" color="default" size="small" />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {election.description}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      Starts: {new Date(election.startTime).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => navigate(`/elections/${election.id}`)}
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Recent Results */}
      {completedElections.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Recent Results
          </Typography>
          <Grid container spacing={3}>
            {completedElections.slice(0, 3).map((election) => (
              <Grid item xs={12} md={6} lg={4} key={election.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" component="h2">
                        {election.name}
                      </Typography>
                      <Chip label="Completed" color="success" size="small" />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Total Votes: {election.totalVotes}
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => navigate(`/results/${election.id}`)}
                    >
                      View Results
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {mockElections.length === 0 && !isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No elections available at the moment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Check back later or contact your election administrator
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
