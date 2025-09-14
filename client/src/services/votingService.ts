import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

interface ElectionData {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  state: string;
  candidates: string[];
  registeredVoters: number;
  totalVotes: number;
}

interface VoteData {
  commitment: string;
  zkProof: any;
  nullifier: string;
}

interface RegistrationData {
  voterAddress: string;
  didHash: string;
  credentialHash: string;
  zkProof: any;
}

class VotingService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Election Management
  async getElections(): Promise<ElectionData[]> {
    try {
      const response = await this.apiClient.get('/elections');
      return response.data.elections || [];
    } catch (error) {
      console.error('Failed to fetch elections:', error);
      throw new Error('Failed to fetch elections');
    }
  }

  async getElection(electionId: string): Promise<ElectionData> {
    try {
      const response = await this.apiClient.get(`/election/${electionId}`);
      return response.data.election;
    } catch (error) {
      console.error('Failed to fetch election:', error);
      throw new Error('Failed to fetch election details');
    }
  }

  async createElection(electionData: Partial<ElectionData>): Promise<string> {
    try {
      const response = await this.apiClient.post('/elections', electionData);
      return response.data.electionId;
    } catch (error) {
      console.error('Failed to create election:', error);
      throw new Error('Failed to create election');
    }
  }

  // Voter Registration
  async registerVoter(electionId: string, registrationData: RegistrationData): Promise<string> {
    try {
      const response = await this.apiClient.post(
        `/election/${electionId}/register`,
        registrationData
      );
      return response.data.transactionHash;
    } catch (error) {
      console.error('Failed to register voter:', error);
      throw new Error('Failed to register voter');
    }
  }

  async getRegistrationStatus(electionId: string, voterAddress: string): Promise<{ isRegistered: boolean }> {
    try {
      const response = await this.apiClient.get(
        `/election/${electionId}/registration-status/${voterAddress}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to check registration status:', error);
      return { isRegistered: false };
    }
  }

  // Voting
  async castVote(electionId: string, voteData: VoteData): Promise<string> {
    try {
      const response = await this.apiClient.post(
        `/election/${electionId}/vote`,
        voteData
      );
      return response.data.transactionHash;
    } catch (error) {
      console.error('Failed to cast vote:', error);
      throw new Error('Failed to cast vote');
    }
  }

  async getVotingStatus(electionId: string, voterAddress: string): Promise<{ hasVoted: boolean }> {
    try {
      const response = await this.apiClient.get(
        `/election/${electionId}/voting-status/${voterAddress}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to check voting status:', error);
      return { hasVoted: false };
    }
  }

  // Results
  async getElectionResults(electionId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/election/${electionId}/results`);
      return response.data.results;
    } catch (error) {
      console.error('Failed to fetch election results:', error);
      throw new Error('Failed to fetch election results');
    }
  }

  // Encryption Services
  async getEncryptionPublicKey(): Promise<any> {
    try {
      const response = await this.apiClient.get('/encryption/public-key');
      return response.data.publicKey;
    } catch (error) {
      console.error('Failed to get encryption public key:', error);
      throw new Error('Failed to get encryption public key');
    }
  }

  async encryptVote(vote: number): Promise<string> {
    try {
      const response = await this.apiClient.post('/encryption/encrypt-vote', { vote });
      return response.data.encryptedVote;
    } catch (error) {
      console.error('Failed to encrypt vote:', error);
      throw new Error('Failed to encrypt vote');
    }
  }

  async tallyEncryptedVotes(encryptedVotes: string[]): Promise<string> {
    try {
      const response = await this.apiClient.post('/encryption/tally-votes', { encryptedVotes });
      return response.data.encryptedTally;
    } catch (error) {
      console.error('Failed to tally encrypted votes:', error);
      throw new Error('Failed to tally encrypted votes');
    }
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export const votingService = new VotingService();
