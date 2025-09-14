// Mock Blockchain Service for Government-Grade Voting System
export interface Vote {
  id: string;
  voterHash: string;
  candidateId: string;
  timestamp: number;
  blockHash: string;
  transactionHash: string;
  encrypted: boolean;
}

export interface Block {
  hash: string;
  previousHash: string;
  timestamp: number;
  votes: Vote[];
  merkleRoot: string;
  nonce: number;
}

export interface VoterRegistration {
  id: string;
  publicKey: string;
  isVerified: boolean;
  hasVoted: boolean;
  registrationTimestamp: number;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  imageUrl?: string;
}

export interface ElectionConfig {
  isActive: boolean;
  startTime: number;
  endTime: number;
  title: string;
  description: string;
}

class BlockchainVotingService {
  private blocks: Block[] = [];
  private voters: Map<string, VoterRegistration> = new Map();
  private candidates: Candidate[] = [];
  private electionConfig: ElectionConfig = {
    isActive: false,
    startTime: 0,
    endTime: 0,
    title: "2024 General Election",
    description: "National General Election with Blockchain Security"
  };

  constructor() {
    this.initializeGenesis();
    this.initializeCandidates();
  }

  private initializeGenesis() {
    const genesisBlock: Block = {
      hash: "0000000000000000000000000000000000000000000000000000000000000000",
      previousHash: "",
      timestamp: Date.now(),
      votes: [],
      merkleRoot: "genesis",
      nonce: 0
    };
    this.blocks.push(genesisBlock);
  }

  private initializeCandidates() {
    this.candidates = [
      { 
        id: "1", 
        name: "Alice Johnson", 
        party: "Democratic Party",
        imageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
      },
      { 
        id: "2", 
        name: "Bob Smith", 
        party: "Republican Party",
        imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
      },
      { 
        id: "3", 
        name: "Carol Williams", 
        party: "Independent",
        imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
      },
      { 
        id: "4", 
        name: "David Brown", 
        party: "Green Party",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
      }
    ];
  }

  // Voter Registration with Zero-Knowledge Proof simulation
  async registerVoter(citizenId: string): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    try {
      // Simulate identity verification delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const publicKey = this.generatePublicKey(citizenId);
      const hashedId = this.hashString(citizenId);
      
      if (this.voters.has(hashedId)) {
        return { success: false, error: "Voter already registered" };
      }

      // Simulate government database verification
      if (citizenId.length < 6) {
        return { success: false, error: "Invalid Citizen ID format" };
      }

      const registration: VoterRegistration = {
        id: hashedId,
        publicKey,
        isVerified: true,
        hasVoted: false,
        registrationTimestamp: Date.now()
      };

      this.voters.set(hashedId, registration);
      return { success: true, publicKey };
    } catch (error) {
      return { success: false, error: "Registration failed" };
    }
  }

  // Cast Vote with Privacy Preservation
  async castVote(voterKey: string, candidateId: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      // Simulate blockchain transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!this.electionConfig.isActive) {
        return { success: false, error: "Election is not active" };
      }

      const now = Date.now();
      if (now < this.electionConfig.startTime || now > this.electionConfig.endTime) {
        return { success: false, error: "Election is not in voting period" };
      }

      const voterHash = this.hashString(voterKey);
      const voter = this.voters.get(voterHash);

      if (!voter) {
        return { success: false, error: "Voter not registered" };
      }

      if (voter.hasVoted) {
        return { success: false, error: "Voter has already voted" };
      }

      const vote: Vote = {
        id: this.generateId(),
        voterHash: voterHash,
        candidateId,
        timestamp: Date.now(),
        blockHash: "",
        transactionHash: this.generateTransactionHash(),
        encrypted: true
      };

      // Update voter status
      voter.hasVoted = true;
      this.voters.set(voterHash, voter);

      // Add to blockchain
      this.addVoteToBlock(vote);

      return { success: true, transactionHash: vote.transactionHash };
    } catch (error) {
      return { success: false, error: "Vote casting failed" };
    }
  }

  private addVoteToBlock(vote: Vote) {
    const latestBlock = this.blocks[this.blocks.length - 1];
    const newBlock: Block = {
      hash: this.generateBlockHash(latestBlock.hash, [vote]),
      previousHash: latestBlock.hash,
      timestamp: Date.now(),
      votes: [vote],
      merkleRoot: this.calculateMerkleRoot([vote]),
      nonce: Math.floor(Math.random() * 1000000)
    };

    vote.blockHash = newBlock.hash;
    this.blocks.push(newBlock);
  }

  // Get Election Results
  getResults(): { [candidateId: string]: number } {
    const results: { [candidateId: string]: number } = {};
    
    this.candidates.forEach(candidate => {
      results[candidate.id] = 0;
    });

    this.blocks.forEach(block => {
      block.votes.forEach(vote => {
        if (results[vote.candidateId] !== undefined) {
          results[vote.candidateId]++;
        }
      });
    });

    return results;
  }

  // Audit Trail
  getAuditTrail(): Block[] {
    return this.blocks;
  }

  // Verify Vote
  verifyVote(transactionHash: string): Vote | null {
    for (const block of this.blocks) {
      const vote = block.votes.find(v => v.transactionHash === transactionHash);
      if (vote) return vote;
    }
    return null;
  }

  // Election Management
  startElection(durationHours: number = 24) {
    this.electionConfig.isActive = true;
    this.electionConfig.startTime = Date.now();
    this.electionConfig.endTime = Date.now() + (durationHours * 60 * 60 * 1000);
  }

  endElection() {
    this.electionConfig.isActive = false;
  }

  getElectionStatus() {
    return {
      ...this.electionConfig,
      timeRemaining: Math.max(0, this.electionConfig.endTime - Date.now())
    };
  }

  getCandidates(): Candidate[] {
    return this.candidates;
  }

  getBlockchainStats() {
    const totalVotes = this.blocks.reduce((sum, block) => sum + block.votes.length, 0);
    const registeredVoters = this.voters.size;
    const votedCount = Array.from(this.voters.values()).filter(v => v.hasVoted).length;

    return {
      totalBlocks: this.blocks.length,
      totalVotes,
      registeredVoters,
      votedCount,
      turnoutPercentage: registeredVoters > 0 ? (votedCount / registeredVoters) * 100 : 0,
      networkHashRate: "2.5 TH/s", // Mock value
      lastBlockTime: this.blocks[this.blocks.length - 1]?.timestamp || 0
    };
  }

  // Security and Verification Methods
  validateVoterEligibility(citizenId: string): boolean {
    // Mock government database check
    return citizenId.length >= 6 && /^[A-Z0-9]+$/.test(citizenId.toUpperCase());
  }

  generateVoterReceipt(transactionHash: string): string {
    const vote = this.verifyVote(transactionHash);
    if (!vote) return "";
    
    return `RECEIPT-${transactionHash}-${Date.now()}`;
  }

  // Utility Methods
  private generatePublicKey(input: string): string {
    return `pk_${this.hashString(input).substring(0, 16)}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateTransactionHash(): string {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private generateBlockHash(previousHash: string, votes: Vote[]): string {
    const data = previousHash + JSON.stringify(votes) + Date.now();
    return `0x${this.hashString(data)}`;
  }

  private hashString(input: string): string {
    // Simple hash simulation - in production, use proper cryptographic hash
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private calculateMerkleRoot(votes: Vote[]): string {
    if (votes.length === 0) return "empty";
    return `0x${this.hashString(JSON.stringify(votes))}`;
  }
}

export const blockchainService = new BlockchainVotingService();
