import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from './ui/use-toast';
import { 
  Shield, 
  Vote, 
  CheckCircle, 
  Clock, 
  Users, 
  BarChart3, 
  FileText, 
  Lock,
  Verified,
  AlertTriangle,
  TrendingUp,
  Database,
  Receipt,
  ExternalLink,
  Award,
  Globe
} from 'lucide-react';
import { blockchainService } from '../services/mockBlockchainService';

interface VoterSession {
  isRegistered: boolean;
  hasVoted: boolean;
  publicKey?: string;
  citizenId?: string;
}

const GovernmentVotingInterface: React.FC = () => {
  const [voterSession, setVoterSession] = useState<VoterSession>({
    isRegistered: false,
    hasVoted: false
  });
  const [citizenId, setCitizenId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [loading, setLoading] = useState(false);
  const [electionStatus, setElectionStatus] = useState(blockchainService.getElectionStatus());
  const [candidates] = useState(blockchainService.getCandidates());
  const [stats, setStats] = useState(blockchainService.getBlockchainStats());
  const [results, setResults] = useState(blockchainService.getResults());
  const [auditTrail] = useState(blockchainService.getAuditTrail());
  const [voteReceipt, setVoteReceipt] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      setElectionStatus(blockchainService.getElectionStatus());
      setStats(blockchainService.getBlockchainStats());
      setResults(blockchainService.getResults());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRegisterVoter = async () => {
    if (!citizenId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Citizen ID",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await blockchainService.registerVoter(citizenId);
      if (result.success) {
        setVoterSession({
          isRegistered: true,
          publicKey: result.publicKey,
          hasVoted: false,
          citizenId
        });
        toast({
          title: "Registration Successful",
          description: "You are now registered to vote",
          variant: "default"
        });
      } else {
        toast({
          title: "Registration Failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Registration failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (!selectedCandidate) {
      toast({
        title: "Error",
        description: "Please select a candidate",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await blockchainService.castVote(voterSession.publicKey!, selectedCandidate);
      if (result.success) {
        // Generate a mock transaction hash for demonstration
        const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
        setVoteReceipt(mockTxHash);
        setVoterSession({ ...voterSession, hasVoted: true });
        setShowReceipt(true);
        
        toast({
          title: "Vote Cast Successfully",
          description: "Your vote has been recorded on the blockchain",
          variant: "default"
        });
      } else {
        toast({
          title: "Voting Failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Vote casting failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startDemoElection = () => {
    blockchainService.startElection(1); // 1 hour demo
    setElectionStatus(blockchainService.getElectionStatus());
    toast({
      title: "Election Started",
      description: "Demo election is now active for 1 hour",
      variant: "default"
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Election ended";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="container mx-auto px-4 py-8 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white/15 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                <Shield className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  SecureVote
                </h1>
                <p className="text-blue-200 text-lg font-medium">Government-Grade Blockchain Democracy</p>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-1 text-sm text-blue-300">
                    <Globe className="h-4 w-4" />
                    <span>Ethereum Mainnet</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-blue-300">
                    <Lock className="h-4 w-4" />
                    <span>Zero-Knowledge Proofs</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right space-y-3">
              <Badge 
                variant={electionStatus.isActive ? "default" : "secondary"}
                className={`text-sm px-4 py-2 ${electionStatus.isActive ? 'bg-green-500/20 text-green-100 border-green-400' : 'bg-gray-500/20 text-gray-300 border-gray-400'}`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${electionStatus.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                  <span>{electionStatus.isActive ? "Election Live" : "Election Inactive"}</span>
                </div>
              </Badge>
              {!electionStatus.isActive && (
                <Button 
                  onClick={startDemoElection}
                  variant="secondary"
                  size="sm"
                  className="block ml-auto bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-sm"
                >
                  <Vote className="h-4 w-4 mr-2" />
                  Start Demo Election
                </Button>
              )}
              {electionStatus.isActive && (
                <div className="text-sm text-blue-200">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {formatTimeRemaining(electionStatus.timeRemaining)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="vote" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="vote" className="flex items-center space-x-2">
              <Vote className="h-4 w-4" />
              <span>Vote</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Results</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Audit Trail</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Statistics</span>
            </TabsTrigger>
          </TabsList>

          {/* Voting Tab */}
          <TabsContent value="vote" className="space-y-6">
            {!electionStatus.isActive && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Election Not Active</AlertTitle>
                <AlertDescription>
                  Election is not currently active. Please wait for the election period or start a demo election.
                </AlertDescription>
              </Alert>
            )}

            {!voterSession.isRegistered ? (
              <Card className="max-w-md mx-auto">
                <CardHeader className="text-center">
                  <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-2xl">Voter Registration</CardTitle>
                  <CardDescription>
                    Register with your Citizen ID to participate in the election. Your identity will be verified using zero-knowledge proofs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="citizenId">Citizen ID</Label>
                    <Input
                      id="citizenId"
                      placeholder="Enter your Citizen ID (e.g., ABC123456)"
                      value={citizenId}
                      onChange={(e) => setCitizenId(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button 
                    onClick={handleRegisterVoter} 
                    disabled={loading || !citizenId.trim()}
                    className="w-full"
                  >
                    {loading ? "Registering..." : "Register to Vote"}
                  </Button>
                </CardContent>
              </Card>
            ) : voterSession.hasVoted ? (
              <Card className="max-w-lg mx-auto">
                <CardHeader className="text-center">
                  <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl text-green-700">Vote Successfully Recorded</CardTitle>
                  <CardDescription>
                    Your vote has been encrypted and recorded on the blockchain. Thank you for participating in democracy!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    <Verified className="h-4 w-4" />
                    <span>Cryptographically verified on blockchain</span>
                  </div>
                  
                  {voteReceipt && (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center space-x-2 mb-2">
                        <Receipt className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-sm">Vote Verification Receipt</span>
                      </div>
                      <div className="font-mono text-xs bg-white p-2 rounded border break-all">
                        {voteReceipt}
                      </div>
                      <div className="mt-3 flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`https://sepolia.etherscan.io/tx/${voteReceipt}`, '_blank')}
                          className="flex items-center space-x-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View on Etherscan</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(voteReceipt)}
                        >
                          Copy Receipt
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Award className="h-3 w-3 mr-1" />
                      Civic Duty Completed
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <Vote className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl">Cast Your Vote</CardTitle>
                  <CardDescription>
                    Select your preferred candidate. Your vote will be encrypted and recorded on the blockchain.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    <Lock className="h-4 w-4" />
                    <span>Voter verified: {voterSession.publicKey}</span>
                  </div>
                  
                  <div className="grid gap-4">
                    {candidates.map((candidate) => (
                      <Card 
                        key={candidate.id}
                        className={`cursor-pointer transition-all ${
                          selectedCandidate === candidate.id 
                            ? 'ring-2 ring-blue-500 bg-blue-50' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedCandidate(candidate.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                              <Users className="h-6 w-6 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{candidate.name}</h3>
                              <p className="text-gray-600">{candidate.party}</p>
                            </div>
                            <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center">
                              {selectedCandidate === candidate.id && (
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button 
                    onClick={handleCastVote}
                    disabled={loading || !selectedCandidate || !electionStatus.isActive}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? "Recording Vote..." : "Cast Vote"}
                  </Button>
                  
                  {electionStatus.isActive && (
                    <div className="text-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {formatTimeRemaining(electionStatus.timeRemaining)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Election Results</span>
                </CardTitle>
                <CardDescription>
                  Live results from the blockchain. All votes are verifiable and immutable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidates.map((candidate) => {
                  const votes = results[candidate.id] || 0;
                  const percentage = stats.totalVotes > 0 ? (votes / stats.totalVotes) * 100 : 0;
                  
                  return (
                    <div key={candidate.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">{candidate.name}</h3>
                          <p className="text-sm text-gray-600">{candidate.party}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{votes} votes</div>
                          <div className="text-sm text-gray-600">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Blockchain Audit Trail</span>
                </CardTitle>
                <CardDescription>
                  Complete blockchain history showing all blocks and transactions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {auditTrail.slice(-10).reverse().map((block, index) => (
                    <Card key={block.hash} className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-mono text-sm">
                              <strong>Block:</strong> {block.hash.slice(0, 20)}...
                              <Badge variant="outline" className="ml-2">
                                {formatTime(block.timestamp)}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {block.votes.length} votes
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div><strong>Previous:</strong> {block.previousHash.slice(0, 20)}...</div>
                          <div><strong>Merkle Root:</strong> {block.merkleRoot}</div>
                          <div><strong>Nonce:</strong> {block.nonce}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Blocks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBlocks}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Votes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalVotes}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Registered Voters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.registeredVoters}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Turnout Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.turnoutPercentage.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Election Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Election Title</Label>
                    <div className="mt-1">{electionStatus.title}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Status</Label>
                    <Badge variant={electionStatus.isActive ? "default" : "secondary"} className="mt-1">
                      {electionStatus.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {electionStatus.startTime > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Start Time</Label>
                        <div className="mt-1">{formatTime(electionStatus.startTime)}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">End Time</Label>
                        <div className="mt-1">{formatTime(electionStatus.endTime)}</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GovernmentVotingInterface;
